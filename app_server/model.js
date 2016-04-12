var mongoose = require('mongoose');
require('./db.js');

var commentSchema = new mongoose.Schema({
    commentId: String, author: String, date: Date, body: String, img: String,
    comments: [{
        commentId: Number,
        author: String,
        body: String,
        date: Date
    }]
});

var postSchema = new mongoose.Schema({
    id: String, author: String, img: String, date: Date, body: String,
    comments: [commentSchema]
});

var userSchema = new mongoose.Schema({
    username: String, salt: String, hash: String
});

var profileSchema = new mongoose.Schema({
    username: String,
    status: String,
    following: [String],
    email: String,
    zipcode: String,
    picture: String
});

exports.Post = mongoose.model('Post', postSchema);
exports.User = mongoose.model('User', userSchema);
exports.Profile = mongoose.model('Profile', profileSchema);