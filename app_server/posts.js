// Endpoints that contains all user profile information except passwords which is in auth.js
exports.setup = function (app) {
    app.get('/posts/:id*?', isLoggedIn, getPost);
    app.post('/post', isLoggedIn, addPost);
    app.put('/posts/:id', isLoggedIn, setPost)
};
var isLoggedIn = require('./auth.js').isLoggedIn;
var getHash = require('./auth.js').getHash;
var Post = require('./model.js').Post;
//Post.remove({}, function(err) {
//    console.log('********** collection Post removed **********')
//});
//
//new Post({
//    id: getHash("sz32test", new Date().getTime(), 1),
//    author: 'sz32test',
//    img: "http://40.media.tumblr.com/59332776ff90eb35500a4d5a0e09b383/tumblr_mxmhunKOl71qz83rmo1_1280.jpg",
//    date: new Date().getTime(),
//    body: 'This is my first post',
//    comments: [{
//        commentId: getHash("sz32test", new Date().getTime(), 2),
//        author: "sz32test",
//        body: 'This is my first comment',
//        date: new Date().getTime()
//    }]
//}).save();
//
//new Post({
//    id: getHash("sz32test", new Date().getTime(), 3),
//    author: 'sz32test',
//    img: "https://sgartpaintings.files.wordpress.com/2009/11/monet-harbour-at-argenteuil.jpg",
//    date: new Date().getTime(),
//    body: 'This is my second post',
//    comments: [{
//        commentId: getHash("sz32test", new Date().getTime(), 4),
//        author: "sz32test",
//        body: 'This is my 2nd comment',
//        date: new Date().getTime()
//    }]
//}).save();
//
//new Post({
//    id: getHash("sz32test", new Date().getTime(), 5),
//    author: 'sz32test',
//    img: "http://cdn.ek.aero/us/english/images/Houston_tcm272-2374719.jpg",
//    date: new Date().getTime(),
//    body: 'This is my 3rd post',
//    comments: [{
//        commentId: getHash("sz32test", new Date().getTime(), 6),
//        author: "sz32test",
//        body: 'This is my 3rd comment',
//        date: new Date().getTime()
//    }]
//}).save();
//
//new Post({
//    id: getHash("sz32test", new Date().getTime(), 7),
//    author: 'sz32test',
//    img: "https://upload.wikimedia.org/wikipedia/commons/d/de/Lovett_Hall.jpg",
//    date: new Date().getTime(),
//    body: 'This is my 4th post',
//    comments: [{
//        commentId: getHash("sz32test", new Date().getTime(), 8),
//        author: "sz32test",
//        body: 'This is my 4th comment',
//        date: new Date().getTime()
//    }]
//}).save();

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
