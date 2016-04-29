exports.setup = function (app) {
    app.get('/statuses/:users*?', isLoggedIn, getStatues);
    app.get('/status', isLoggedIn, getStatus);
    app.put('/status', isLoggedIn, setStatus);
    app.get('/email/:user*?', isLoggedIn, getEmail);
    app.put('/email', isLoggedIn, setEmail);
    app.get('/zipcode/:user*?', isLoggedIn, getZipcode);
    app.put('/zipcode', isLoggedIn, setZipcode);
    app.get('/pictures/:user*?', isLoggedIn, getPictures);
    app.put('/picture', isLoggedIn, uploadImage, setPicture);
};

var isLoggedIn = require('./auth.js').isLoggedIn;
var Profile = require('./model.js').Profile;
var Post = require('./model.js').Post;
var getHash = require('./auth.js').getHash;

// Get the statuses for multiple users.
function getStatues(req, res) {
    var usernames = req.params.users ? req.params.users.split(',') : [req.user];
    var statuses = [];
    // Use promise to solve the asynchronous call.
    var promises = usernames.map(function (username) {
        return new Promise(function (resolve, reject) {
            Profile.find({username: username}, function (err, result) {
                if (err) return err.json({error: "Error finding " + username + "status"});
                var user = result[0];
                statuses.push({"username": user.username, "status": user.status});
                resolve();
            })
        })
    });
    Promise.all(promises).then(function () {
        res.send({
            'statuses': statuses
        });
    }).catch(console.error);
}

// Get the status for the loggedInUser.
function getStatus(req, res) {
    var username = req.user;
    Profile.find({username: username}, function (err, result) {
        if (err) return err.json({error: "Error finding " + username + "status"});
        res.send({
            'statuses': [{
                'username': result[0].username,
                'status': result[0].status
            }]
        });
    })
}

// Update the status for the loggedInUser.
function setStatus(req, res) {
    var username = req.user;
    var newStatus = req.body.status;
    if (!newStatus) {
        res.sendStatus(400); // Bad request
        return
    }
    Profile.update({username: username}, {$set: {status: newStatus}}, function (err, result) {
        if (err) return err.json({error: "Error updating " + username + "status"});
        res.send({
            'statuses': [{
                'username': username,
                'status': newStatus
            }]
        });
    });
}

// Get the email address for the requested user.
function getEmail(req, res) {
    var username = req.params.user ? req.params.user.split(',')[0] : req.user;
    Profile.find({username: username}, function (err, result) {
        if (err) return err.json({error: "Error getting " + username + "email"});
        res.send({
            'username': result[0].username,
            'email': result[0].email
        });
    });
}

// Update the email address for the loggedInUser.
function setEmail(req, res) {
    var username = req.user;
    var newEmail = req.body.email;
    if (!newEmail) {
        res.sendStatus(400); // Bad request
        return
    }
    Profile.update({username: username}, {$set: {email: newEmail}}, function (err, result) {
        if (err) return err.json({error: "Error updating " + username + "email"});
        res.send({
            'username': username,
            'email': newEmail
        });
    });
}

// Get the zipcode for the requested user.
function getZipcode(req, res) {
    var username = req.params.user ? req.params.user.split(',')[0] : req.user;
    Profile.find({username: username}, function (err, result) {
        if (err) return err.json({error: "Error getting " + username + "zipcode"});
        res.send({
            'username': result[0].username,
            'zipcode': result[0].zipcode
        });
    });
}

// Update the zipcode for the loggedInUser.
function setZipcode(req, res) {
    var username = req.user;
    var newZipcode = req.body.zipcode;
    if (!newZipcode) {
        res.sendStatus(400); // Bad request
        return
    }
    Profile.update({username: username}, {$set: {zipcode: newZipcode}}, function (err, result) {
        if (err) return err.json({error: "Error updating " + username + "zipcode"});
        res.send({
            'username': username,
            'zipcode': newZipcode
        });
    });
}

// Get the picture address for the requested users.
function getPictures(req, res) {
    var usernames = req.params.user ? req.params.user.split(',') : [req.user];
    var pictures = [];
    var promises = usernames.map(function (username) {
        return new Promise(function (resolve, reject) {
            Profile.find({username: username}, function (err, result) {
                if (err) throw err;
                var user = result[0];
                pictures.push({"username": user.username, "picture": user.picture});
                resolve();
            });
        });
    });
    Promise.all(promises).then(function () {
        res.send({
            'pictures': pictures
        });
    }).catch(console.error)
}


// Upload files to Cloudinary
var multer = require('multer');
var stream = require('stream');
var cloudinary = require('cloudinary');

// Only one single file  named images will be uploaded.
var uploadImage = multer().single('image');


// Dispatch the received picture.
//
// If a picture is included in the request, it will add a post with picture or update logged-in user
// avatar based on the endpoint of request. If no picture is uploaded, a plain post without picture
// will be added.
function setPicture(req, res) {
    var username = req.user;

    // Check if a picture is included in the request.
    if (req.file) {
        var publicName = "image" + req.file + new Date().getTime();
        var uploadStream = cloudinary.uploader.upload_stream(function (result) {
            // Determine if this is for posts or profiles based on the endpoint of requirement.
            if (req.url === "/post") {
                new Post({
                    'id': getHash(username, new Date().getTime()),
                    'author': username,
                    'body': req.body.body,
                    'date': new Date().getTime(),
                    "comments": [],
                    "img": result.url
                }).save(function (err, result) {
                    if (err) return res.json({error: "Error adding post"});
                    res.send({'posts': [result]});
                });
            }
            if (req.url === "/picture") {
                Profile.update({username: username}, {$set: {picture: result.url}}, function (err, result) {
                    if (err) throw err;
                    res.send({
                        'username': username,
                        'picture': result.picture
                    });
                });
            }
        }, {public_id: publicName});

        //Create a passthrough stream to pipe the buffer to the uploadStream for cloudinary.
        var s = new stream.PassThrough();
        s.end(req.file.buffer);
        s.pipe(uploadStream);
        // Instruct cloudinary to end the upload.
        s.on('end', uploadStream.end);

    } else {
        new Post({
            'id': getHash(username, new Date().getTime()),
            'author': username,
            'body': req.body.body,
            'date': new Date().getTime(),
            "comments": []
        }).save(function (err, result) {
            if (err) return res.json({error: "Error adding post"});
            res.send({'posts': [result]});
        });
    }
}

exports.uploadImage = uploadImage;
exports.setPicture = setPicture;

