/*
 * Test suite for profile.js
 */
var request = require('request');

function url(path) {
    return "http://localhost:3000" + path
}

describe('User status API', function () {

    it('gives three statuses of three users', function (done) {
        request(url("/statuses/user1,user2,user3"), function (err, res, body) {
            var parsedBody = JSON.parse(body);
            expect(res.statusCode).toBe(200);
            expect(parsedBody.statuses.length).toBe(3);
            done();
        });
    }, 200);

    it('gets the status of the current user and then changes the status', function (done) {

        var oldStatusBody;
        var newStatus;

        // Get the current status.
        request(url("/status"), function (err, res, body) {
                var parsedBody = JSON.parse(body);
                expect(res.statusCode).toBe(200);
                oldStatusBody = parsedBody.statuses[0].status;
                expect(oldStatusBody).toBeDefined();

                // Generate a new status based on the old one to guarantee that we always have a different status to
                // be updated.
                newStatus = {"status": oldStatusBody.concat("...")};

                // Update the status.
                request({
                        url: url("/status"),
                        method: 'PUT',
                        json: newStatus
                    },
                    function (err, res, body) {
                        expect(res.statusCode).toBe(200);
                        // verify status has been changed to the new one.
                        expect(body.statuses[0].status).toNotEqual(oldStatusBody);
                        expect(body.statuses[0].status).toEqual(newStatus.status);
                        done();
                    });
            }
        );
    }, 200);
});
