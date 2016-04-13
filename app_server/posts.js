// Endpoints that contains all user profile information except passwords which is in auth.js
exports.setup = function (app) {
    app.get('/posts/:id*?', isLoggedIn, getPost);
    app.post('/post', isLoggedIn, addPost);
    app.put('/posts/:id', isLoggedIn, setPost)
};
var isLoggedIn = require('./auth.js').isLoggedIn;
var getHash = require('./auth.js').getHash;
var Post = require('./model.js').Post;

function addPost(req, res) {
    var username = req.user;
    new Post({
        'id': getHash(username, new Date().getTime()),
        'author': username,
        'body': req.body.body,
        'date': new Date().getTime(),
        "comments": []
    }).save(function (err, result) {
        if (err) {
            return handleError(err);
        }
        res.send({'posts': [result]});
    });
}

function getPost(req, res) {
    var requestedId = req.params.id ? req.params.id.split(',')[0] : null;
    if (requestedId === null) {
        Post.find({}).sort('-date').exec(function (err, posts) {
            if (err) throw err;
            res.send({'posts': posts});
        })
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
