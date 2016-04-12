/*
 * Test suite for posts.js
 */
var request = require('request');

function url(path) {
    return "http://localhost:3000" + path
}

describe('Post API', function () {

    it('gives three or more posts upon request', function (done) {
        request(url("/posts"), function (err, res, body) {
            var parsedBody = JSON.parse(body);
            expect(res.statusCode).toBe(200);
            expect(parsedBody.posts.length).toBeGreaterThan(2);
            done();
        });
    }, 200);

    it('sets posts with successive post ids, and returns the post each time', function (done) {
        var newPost1 = {"body": "Newly added post 1"};
        var newPost2 = {"body": "Newly added post 2"};
        var post1Id, post2Id;

        // Add a new post.
        request({
                url: url("/post"),
                method: 'POST',
                json: newPost1
            },
            function (err, res, body) {
                // Verify that it has an id and same content as we sent before.
                expect(res.statusCode).toBe(200);
                post1Id = body.posts[0].id;
                expect(post1Id).toBeDefined();
                expect(body.posts[0].body).toEqual(newPost1.body);

                // Add a second post.
                request({
                        url: url("/post"),
                        method: 'POST',
                        json: newPost2
                    },
                    function (err, res, body) {
                        // Verify that the post id increases by one and that the second post has the
                        // correct content.
                        expect(res.statusCode).toBe(200);
                        post2Id = body.posts[0].id;
                        expect(post2Id).toEqual(post1Id + 1);
                        expect(body.posts[0].body).toEqual(newPost2.body);
                        done();
                    });
            }
        );
    }, 200);

    it('returns a post with a specified id', function (done) {
        var requestedId;
        var targetUrl;

        // Get all post id first and then select one randomly.
        request(url("/posts"), function (err, res, body) {
            var parsedBody = JSON.parse(body);
            expect(res.statusCode).toBe(200);
            expect(parsedBody.posts.length).toBeGreaterThan(2);
            requestedId = parsedBody.posts[Math.floor(Math.random() * parsedBody.posts.length)].id;
            targetUrl = "/posts/".concat(requestedId.toString());

            // Get post with the selected id and validate that only one post is returned.
            request(url(targetUrl), function (err, res, body) {
                parsedBody = JSON.parse(body);
                expect(res.statusCode).toBe(200);
                expect(parsedBody.posts.length).toEqual(1);
                done();
            });
        });
    }, 200);


    it('returns nothing for an invalid id', function (done) {
        var requestedId;
        var targetUrl;

        // Verify that it has more than 2 posts.
        request(url("/posts"), function (err, res, body) {
            var parsedBody = JSON.parse(body);
            expect(res.statusCode).toBe(200);
            expect(parsedBody.posts.length).toBeGreaterThan(2);
            requestedId = 0;
            targetUrl = "/posts/".concat(requestedId.toString());

            // Get post with an invalid id and validate that no post is returned.
            request(url(targetUrl), function (err, res, body) {
                parsedBody = JSON.parse(body);
                expect(res.statusCode).toBe(200);
                expect(parsedBody.posts.length).toBe(0);
                done();
            });
        });
    }, 200)
});
