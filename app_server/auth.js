exports.setup = function (app) {
    app.post('/login', login);
    app.put('/logout', isLoggedIn, logout);
    app.post('/register', register);
    app.put('/password', isLoggedIn, setPassword);
    app.get('/authFacebook', passport.authenticate('facebook', {scope: 'email'}));
    app.get('/callback', passport.authenticate('facebook', {successRedirect: '/profile', failureRedirect: '/fail'}));
    app.get('/profile', isLoggedIn, profile);
    app.get('/fail', fail)
};

var User = require('./model.js').User;
var Profile = require('./model.js').Profile;
var crypto = require('crypto');
var md5 = require('md5');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;


var REDIS_URL = "redis://h:pcinkgsmv6hcnufv1b4ekgu4f9b@ec2-54-227-250-102.compute-1.amazonaws.com:14679";
var redis = require('redis').createClient(REDIS_URL);
var _cookieKey = 'sid';

// Third-party login.
var port = "3000";
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

    if (req.isAuthenticated()) {
        return next();
    } else if (!sessionKey) {
        return res.sendStatus(401); // Unauthorized
    }

    //var username = _sessionUser[sessionKey];
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
        if (err) {
            return handleError(err)
        }
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
    res.clearCookie(_cookieKey);
    res.send("OK");
}

// Helper function. It returns a hashed string for variable number of arguments
function getHash() {
    var args = Array.prototype.slice.call(arguments);
    return md5(args.join(":"))
}


// Facebook login

var users = {};
var config = {
    clientID: '636790953145162',
    clientSecret: '6ea79c5a2d31f6ddc66451c7b40ef163',
    callbackURL: 'http://localhost:' + port + '/callback'
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

function profile(req, res) {
    res.send('ok now what?', req.user)
}
function fail(req, res) {
    res.send("Failed!")
}
exports.isLoggedIn = isLoggedIn;

exports.getHash = getHash;
