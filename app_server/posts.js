// Endpoints that contains all user profile information except passwords which is in auth.js
exports.setup = function (app) {
    app.get('/posts/:id*?', isLoggedIn, getPost);
    app.post('/post', isLoggedIn, uploadImage, setPicture);
    app.put('/posts/:id', isLoggedIn, setPost)
};
var isLoggedIn = require('./auth.js').isLoggedIn;
var getHash = require('./auth.js').getHash;
var Post = require('./model.js').Post;
var setPicture = require('./profile.js').setPicture;
var uploadImage = require('./profile.js').uploadImage;
var Profile = require('./model.js').Profile;


function getPost(req, res) {
    var requestedId = req.params.id ? req.params.id.split(',')[0] : null;

    // If no ID  is specified, 10 posts of logged in user and his user will be returned.
    if (requestedId === null) {
        var username = req.user;

        Profile.find({username: username}, function (err, result) {
            var user = result[0];
            var usersToQuery = user.following;
            usersToQuery.push(username);
            Post.find({'author': {$in: usersToQuery}}).sort('-date').limit(10).exec(function (err, posts) {
                if (err) throw err;
                res.send({'posts': posts});
            });
        });

        // If an ID is specified, post with this ID will be returned.
    } else {
        Post.find({id: requestedId}, function (err, posts) {
            if (err) throw err;
            res.send({"posts": posts})
        });
    }
}

function setPost(req, res) {
    var postID = req.params.id.split(',')[0];
    var commentID = req.body.commentId ? req.body.commentId : null;
    var user = req.user;
    // Update post when no commentID is supplied.
    if (commentID === null) {
        Post.findOneAndUpdate({id: postID}, {body: req.body.body}, function (err, post) {
            if (err) throw err;
            post.body = req.body.body;
            res.send({"posts": [post]})

        })

    } else if (commentID == "-1") { // Add a comment
        Post.find({id: postID}, function (err, result) {
            if (err) throw err;
            var post = result[0];
            post.comments.push({
                commentId: getHash(user, new Date().getTime()),
                author: user,
                body: req.body.body,
                date: new Date().getTime()
            });
            post.save(function (err, result) {
                if (err) throw err;
                res.send({'posts': [result]});
            })
        })
    } else { // Edit a comment
        Post.find({id: postID}, function (err, result) {
            if (err) throw err;
            var post = result[0];
            var commentIndex = post.comments.findIndex(function (comment) {
                return comment.commentId === commentID;
            });
            post.comments[commentIndex].body = req.body.body;

            post.save(function (err, result) {
                if (err) throw err;
                res.send({'posts': [result]});
            })
        })
    }
}
