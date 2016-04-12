// It contains just stubs for following functionality.
exports.setup = function (app) {
    app.get('/following/:user*?', isLoggedIn, getFollowings);
    app.put('/following/:user', isLoggedIn, addFollowing);
    app.delete('/following/:user', isLoggedIn, removeFollowing);
};

var isLoggedIn = require('./auth.js').isLoggedIn;
var Profile = require('./model.js').Profile;

function getFollowings(req, res) {
    var username = req.params.user ? req.params.user.split(',')[0] : req.user;
    Profile.find({username: username}, function (err, result) {
        var user = result[0];
        res.send({"username": user.username, "following": user.following})
    });
}

function addFollowing(req, res) {
    var username = req.user;
    var toBeAddFollowing = req.params.user ? req.params.user.split(',')[0] : null;
    if (!toBeAddFollowing) {
        res.send(400)
    }
    Profile.find({username: username}, function (err, result) {
        if (err) throw err;
        var user = result[0];
        Profile.find({username: toBeAddFollowing}, function (err, result) {
            if (err) throw err;
            // If new following does exist, add it to user's following list.
            if (result.length > 0) {
                user.following.push(result[0].username);
                user.save(function (err, result) {
                    if (err) throw err;
                    res.send({"username": result.username, "following": result.following})
                });
                // If new following does not exist, ignore this requirement and send back the original following list.
            } else {
                res.send({"username": user.username, "following": user.following})
            }
        });


    });
}
// Remove :user to the following list for the loggedInUser
function removeFollowing(req, res) {
    var username = req.user;
    var toBeRemovedFollowing = req.params.user ? req.params.user.split(',')[0] : null;
    if (!toBeRemovedFollowing) {
        res.send(400)
    }
    Profile.find({username: username}, function (err, result) {
        if (err) throw err;
        var user = result[0];
        var index = user.following.findIndex(function (following) {
            return following === toBeRemovedFollowing
        });
        user.following.splice(index, 1);
        user.save(function (err, user) {
            if (err) throw err;
            res.send({"username": user.username, "following": user.following})
        })
    });
}

