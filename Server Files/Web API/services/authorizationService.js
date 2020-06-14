var jwt = require('jsonwebtoken');
var config = require('../config/config');

module.exports = {

    /**
     * used to authorize/authenticate a token
     */
    checkToken: function (req, res) {
        var payload = undefined;
        // Guard:
        let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
        if (token.startsWith('Bearer ')) {
            // Remove Bearer from string
            token = token.slice(7, token.length);
        }

        console.log("Token: " + token);
        if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });

        jwt.verify(token, config.secret, function (err, decoded) {
            if (err){
                return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
            } else {
                payload = decoded;
            }
        });

        console.log(payload);
        return payload;
    },

    checkIfAdmin: function (payload) {
        if(payload.isAdmin){
            return true;
        }
        return false;
    },

    checkIfTeamLeader: function (payload) {
        if(payload.isTeamLeader){
            return true;
        }
        return false;
    },

    checkIfSameName: function(payload, name) {
        console.log(payload.username + " == " + name);
        if(payload.username == name){
            return true;
        } 
        return false;
    }
};
