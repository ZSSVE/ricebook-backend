exports.setup = function (app) {
    app.post('/login', login);
    app.put('/logout', isLoggedIn, logout);
    app.post('/register', register);
    app.put('/password', isLoggedIn, setPassword);
    app.get('/authFacebook', passport.authenticate('facebook', {scope: ['email']}));
    app.get('/callback', passport.authenticate('facebook', {successRedirect: '/fbLogin', failureRedirect: '/fail'}));
    app.get('/fbLogin', fbLogin);
    app.get('/fail', fail);
    app.post('/linkAccounts', isLoggedIn, linkAccounts);
    app.post('/unlinkAccounts', isLoggedIn, unlinkAccounts);
    app.get('/isLinked', isLoggedIn, isLinked)
};


var User = require('./model.js').User;
var Profile = require('./model.js').Profile;
var Post = require('./model.js').Post;
var crypto = require('crypto');
var md5 = require('md5');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;


var REDIS_URL = "redis://h:pcinkgsmv6hcnufv1b4ekgu4f9b@ec2-54-227-250-102.compute-1.amazonaws.com:14679";
var redis = require('redis').createClient(REDIS_URL);
var _cookieKey = 'sid';

// Third-party login.
var defaultAvatar = "https://tracker.moodle.org/secure/attachment/30912/f3.png";
var defaultStatus = "Becoming a Web Developer!";


// Register a new user.
//
// A User document containing his username, salt and salted hash will be stored in the database.
// A Profile document containg his email, zipcode as well as default avatar and default status will also be stored.
function register(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var salt = crypto.randomBytes(16).toString('hex');
    var saltedHash = getHash(username, password, salt);

    new User({username: username, salt: salt, hash: saltedHash}).save(function (err, result) {
        if (err) return err.json({error: "Error saving" + username + "User"});
    });
    new Profile({
        username: username,
        status: defaultStatus,
        following: [],
        email: req.body.email,
        zipcode: req.body.zipcode,
        picture: defaultAvatar
    }).save(function (err, result) {
        if (err) return err.json({error: "Error saving " + username + "Profile"});
    });
    res.send({username: username, result: "success"})

}


function login(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    // Bad request
    if (!username || !password) {
        res.sendStatus(400);
        return
    }

    User.find({username: username}, function (err, userObjs) {
        // Unauthorized request.
        var userObj = userObjs[0];
        if (!userObj || getHash(username, password, userObj.salt) !== userObj.hash) {
            res.sendStatus(401);
            return
        }

        // Success login
        var sessionKey = getHash(new Date().getTime() + userObj.username);
        redis.set(sessionKey, username);

        // Set cookie
        res.cookie(_cookieKey, sessionKey, {maxAge: 3600 * 1000, httpOnly: true});

        res.send({
            "username": username,
            "result": "success"
        })
    });
}


// Middleware function assures that the user has already logged in for sensitive operations followed
// and also store the username for downstream endpoints.
function isLoggedIn(req, res, next) {
    var sessionKey = req.cookies[_cookieKey];
    if (!sessionKey) {
        return res.sendStatus(401); // Unauthorized
    }

    var username = null;
    redis.get(sessionKey, function (err, user) {
        username = user;
        if (username) {
            req.user = username;
            return next()
        } else {
            res.sendStatus(401);
        }
    });
}


function setPassword(req, res) {
    var username = req.user;
    var newPassword = req.body.password;
    var salt = crypto.randomBytes(16).toString('hex');
    var newHash = getHash(username, newPassword, salt);
    User.update({username: username}, {$set: {hash: newHash, salt: salt}}, function (err) {
        if (err) return res.json({error: "Error changing password"});
        var msg = {"username": username, "status": 'New password is saved!'};
        res.send(msg);
    });
}


// Remove the user information stored and clear cookie.
function logout(req, res) {
    var sessionKey = req.cookies[_cookieKey];
    redis.del(sessionKey, function (err, reply) {
        if (err) return res.json({error: "Error deleting cookie"});
    });
    req.logout();
    res.clearCookie(_cookieKey);
    res.send("OK");
}


// Helper function. It returns a hashed string for variable number of arguments
function getHash() {
    var args = Array.prototype.slice.call(arguments);
    return md5(args.join(":"))
}


// Facebook login.
var users = {};
var config = {
    clientID: '636790953145162',
    clientSecret: '6ea79c5a2d31f6ddc66451c7b40ef163',
    callbackURL: 'https://whispering-ravine-99303.herokuapp.com/callback',
    profileFields: ['email', 'name']
};

passport.serializeUser(function (user, done) {
    users[user.id] = user;
    done(null, user.id)
});

passport.deserializeUser(function (id, done) {
    var user = users[id];
    done(null, user)
});

passport.use(new FacebookStrategy(config,
    function (token, refreshToken, profile, done) {
        process.nextTick(function () {
            return done(null, profile)
        })
    }));


function fbLogin(req, res) {
    if (!req.isAuthenticated()) {
        res.sendStatus(400);
        return
    }
    // Collect user information provided by Facebook.
    var userProfile = req.user;
    var fbID = userProfile.id;
    // Append facebook and facebookID at the end of username received to avoid name conflicts with normal user.
    var username = userProfile.name.givenName + " " + userProfile.name.familyName + "@facebook@" + fbID;
    var userEmail = userProfile.emails ? userProfile.emails[0].value : null;

    User.find({fbID: fbID}, function (err, userObjs) {
        var userObj = userObjs[0];

        // Create new user and profile for users logged in using facebook at the first time.
        if (!userObj) {
            new User({username: username, fbID: fbID}).save(function (err, result) {
                if (err) return err.json({error: "Error saving" + username + "User"});
                new Profile({
                    username: username,
                    status: defaultStatus,
                    following: [],
                    email: userEmail,
                    picture: defaultAvatar
                }).save(function (err, result) {
                    if (err) return err.json({error: "Error saving " + username + "Profile"});
                    fbRelogin(fbID, username, res)
                });
            });
            // Log in an existing facebook user.
        } else {
            // The logged in username does not have to be the original one we assigned. It might be changed during
            // accounts linking.
            fbRelogin(fbID, userObj.username, res);
        }

    })
}


function fbRelogin(fbID, username, res) {

    // Bad request
    if (!username || !fbID) {
        res.sendStatus(400);
        return
    }

    User.find({fbID: fbID}, function (err, userObjs) {
        // Unauthorized request.
        var userObj = userObjs[0];
        if (!userObj) {
            res.sendStatus(401);
            return
        }

        // Success login
        var sessionKey = getHash(new Date().getTime() + fbID);
        redis.set(sessionKey, username);

        // Set cookie
        res.cookie(_cookieKey, sessionKey, {maxAge: 3600 * 1000, httpOnly: true});
        res.redirect('https://lit-sands-78221.herokuapp.com#/main');
    });
}


// Send user back to log in page if the Facebook log in failed.
function fail(req, res) {
    res.redirect('https://lit-sands-78221.herokuapp.com/');
}


function linkAccounts(req, res) {
    var normalUsername = req.body.username;
    var normalPassword = req.body.password;
    var normalProfile = null;
    var fbProfile = null;
    var normalUser = null;
    var fbUser = null;

    // Bad request
    if (!normalUsername || !normalPassword) {
        res.sendStatus(400);
        return
    }
    // Get two User documents.
    User.find({username: {$in: [normalUsername, req.user]}}, function (err, userObjs) {
        // Two documents need to be returned.
        if (userObjs.length != 2) {
            res.sendStatus(400);
            return
        }
        fbUser = userObjs[0].fbID ? userObjs[0] : userObjs[1];
        normalUser = userObjs[1].salt ? userObjs[1] : userObjs[0];
        // Unauthorized request.
        if (!normalUser || getHash(normalUsername, normalPassword, normalUser.salt) !== normalUser.hash) {
            res.sendStatus(401);
            return
        }

        // Query two Profile documents.
        Profile.find({username: {$in: [normalUsername, req.user]}}, function (err, profileObjs) {
            // Two documents need to be returned.
            if (profileObjs.length != 2) {
                res.sendStatus(400);
                return
            }
            fbProfile = profileObjs[0].zipcode ? profileObjs[1] : profileObjs[0];
            normalProfile = profileObjs[1].zipcode ? profileObjs[1] : profileObjs[0];
            var mergedFollowing = normalProfile.following;
            fbProfile.following.forEach(function (following) {
                if (mergedFollowing.indexOf(following) < 0) {
                    mergedFollowing.push(following)
                }
            });
            // Add facebookID into normal user account.
            User.update({username: normalUsername}, {
                $set: {
                    fbID: fbUser.fbID
                }
            }, function (err, result) {
                if (err) return err.json({error: "Error merging users"});
                // Add additional followings into normal user profile.
                Profile.update({username: normalUsername}, {
                    $set: {
                        following: mergedFollowing
                    }
                }, function (err, result) {
                    if (err) return err.json({error: "Error merging profiles"});
                    // Update posts' author info from facebook user to merged normal user.
                    Post.update({author: req.user}, {
                        $set: {
                            author: normalUsername
                        }
                    }, {multi: true}, function (err, result) {
                        // Only removing facebook documents after merging successfully.
                        Profile.find({username: req.user}).remove().exec();
                        User.find({username: req.user}).remove().exec();

                        // Log out facebook authorized account.
                        req.logout();
                        res.clearCookie(_cookieKey);

                        // Set new session cookie for  merged user.
                        var sessionKey = getHash(new Date().getTime() + normalUsername);
                        redis.set(sessionKey, normalUsername);
                        res.cookie(_cookieKey, sessionKey, {maxAge: 3600 * 1000, httpOnly: true});
                        res.send({
                            'result': "success"
                        });
                    });
                })
            });
        });
    })
}


function isLinked(req, res) {
    // If a user has an salt and fbID at the same time, this account is an linked account.
    User.find({username: req.user}, function (err, result) {
        var user = result[0];
        if (user.salt && user.fbID) {
            res.send({"isLinked": true})
        } else {
            res.send({"isLinked": false})
        }
    })

}


// Simply delete facebook field to unlink accounts.
// Facebook authorized user will have to register again if he want to log in.
function unlinkAccounts(req, res) {
    User.update({username: req.user}, {$set: {fbID: null}}, function (err) {
        if (err) return res.json({error: "Error unlinking accounts"});
        res.send({"isLinked": false});
    });

}

exports.isLoggedIn = isLoggedIn;
exports.getHash = getHash;

