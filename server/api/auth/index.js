/**
 * 'api/auth': Authentication API to Sign In/Out users
 */

var express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authJwt = require('../jwt-helper');

var runtime;
var secretCode;
var tokenExpiresIn;

module.exports = {
    init: function (_runtime, _secretCode, _tokenExpires) {
        runtime = _runtime;
        secretCode = _secretCode;
        tokenExpiresIn = _tokenExpires;
    },
    app: function () {
        var authApp = express();
        authApp.use(function (req, res, next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * POST SignIn
         * Sign In with User credentials
         */
        authApp.post('/api/signin', function (req, res, next) {
            runtime.users.findOne(req.body).then(function (userInfo) {
                if (userInfo && userInfo.length > 0 && userInfo[0].password) {
                    if (bcrypt.compareSync(req.body.password, userInfo[0].password)) {
                        const token = jwt.sign({ id: userInfo[0].username, groups: userInfo[0].groups }, secretCode, { expiresIn: tokenExpiresIn });//'1h' });
                        res.json({ status: 'success', message: 'user found!!!', data: { username: userInfo[0].username, fullname: userInfo[0].fullname, groups: userInfo[0].groups , token: token } });
                        runtime.logger.info('api-signin: ' + userInfo[0].username + ' ' + userInfo[0].fullname + ' ' + userInfo[0].groups);
                    } else {
                        res.status(401).json({ status: 'error', message: 'Invalid email/password!!!', data: null });
                        runtime.logger.error('api post signin: Invalid email/password!!!');
                    }
                } else {
                    res.status(404).end();
                    runtime.logger.error('api post signin: Not Found!');
                }
            }).catch(function (error) {
                if (error.code) {
                    res.status(400).json({error:error.code, message: error.message});
                } else {
                    res.status(400).json({error:'unexpected_error', message:error.toString()});
                }
                runtime.logger.error('api post signin: ' + error.message);
            });
        });

        return authApp;
    }
}