// BASE FOR THE SERVER 
var express = require('express');
// var app = express();

// Routing
var router = express.Router();

// Authentication
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var config = require('../config/config');

// MongoDB service
const dbService = require('../services/dbService');
var database = dbService.getDb();
var usersCollection = database.collection("users");
var teamsCollection = database.collection("teams");

// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var User = require('../models/user');
var Team = require('../models/team');

// Token / Guards
var authorizationService = require('../services/authorizationService');

/**
 * POST to register a user
 */
router.route('/registration')

    .post(async function (req, res) {

        var userError = false;
        var teamError = false;
        var created = false;
        var hashedPassword = bcrypt.hashSync(req.body.password);
        console.log("Request: " + JSON.stringify(req.body));

        var user = new User(
            {
                fullName: req.body.fullName,
                username: req.body.username,
                password: hashedPassword,
                isTeamLeader: req.body.isTeamLeader,
                isAdmin: req.body.isAdmin,
                team: req.body.team
            });

        // This part will check that the team leader is also associated with a team. You cannot be a team leader without a team name
        if (user.isTeamLeader && user.team === null) {
            console.log("User was marked as a Team Leader but did not provide a team name. Therefore he will be unassigned as Team Leader");
            user.isTeamLeader = false;
        }

        // This method will try to find a user in the Db with this username, to ensure that he doesn't already exist
        usersCollection.findOne({ 'username': user.username }, { _id: 0, __v: 0 }, function (err, result) {
            if (err) {
                userError = true;
                return res.send(err);

            }
            if (result) {
                userError = true;
                console.log("User exists");
                return res.status(406).send("This user already exists! Please use another one");
            }

            // If user is a team leader, we need to ensure that the team name is not already taken
            // Remove any team name if the user is not a team leader
            if (!user.isTeamLeader) {
                user.team = null
            }
            // If team name is not null and the user doesn't exist we will check if the team name is taken 
            if (user.teamName !== null && !userError) {
                teamsCollection.findOne({ 'teamName': user.team }, { _id: 0, __v: 0 }, function (err, result) {
                    if (err) {
                        teamError = true;
                        return res.send(err);
                    }
                    if (result) {
                        teamError = true;
                        console.log("Team Exists");
                        return res.status(406).send("This team name already exists! Please use another one");
                    }

                    // If the username and team doesn't exist already (success scenario)
                    if (!userError && !teamError) {

                        usersCollection.insertOne(user, (error, result) => {
                            if (error) {
                                return res.status(500).send(error);
                            } else { created = true; }


                            // If the username exists and the person is marked as a team leader, the team will be created as well
                            if (user.isTeamLeader) {

                                var team = new Team(
                                    {
                                        teamName: user.team
                                    });

                                team.users.push({ username: user.username, fullName: user.fullName, isTeamLeader: user.isTeamLeader });

                                teamsCollection.insertOne(team, (error, result) => {
                                    if (error) {
                                        created = false;
                                        return res.status(500).send(error);
                                    }
                                });
                            }
                            // create a token
                            var token = jwt.sign({ username: user.username }, config.secret, {
                                expiresIn: 86400 // expires in 24 hours
                            });

                            // Return a token to the client
                            if (created) {
                                return res.status(201).json({ token: token, fullName: user.fullName, username: user.username, isTeamLeader: user.isTeamLeader, isAdmin: user.isAdmin, team: user.team });
                            }
                        });
                    }
                });
            }
        });
    });

/**
 * POST to login with an existing user
 */
router.route('/login')
    .post(function (req, res) {
        console.log("Request: " + JSON.stringify(req.body));
        usersCollection.findOne({ 'username': req.body.username }, function (err, user) {
            if (err) return res.status(500).send({ 'message': 'Error on the server.' });
            if (!user) return res.status(404).send({ "message": "No user found." });
            // This method will compare the password given in the request body with the one in the Db
            // The one from the request body is encrypted while performing this process 
            var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
            // If the password is invalid the 401 will be returned to the client
            if (!passwordIsValid) return res.status(401).send({ "message": "Wrong password" }); // { auth: false, token: null }
            // Otherwise we will create a token
            var token = jwt.sign({ username: user.username, isTeamLeader: user.isTeamLeader, isAdmin: user.isAdmin, team: user.team }, config.secret, {
                expiresIn: 86400 // expires in 24 hours
            });

            res.status(201).send({ token: token, fullName: user.fullName, username: user.username, isAdmin: user.isAdmin, isTeamLeader: user.isTeamLeader, team: user.team });
        });
    });

/**
 * GET to validate the token 
 */
router.route('/validateToken')
    .get(function (req, res) {
        let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
        if (token.startsWith('Bearer ')) {
            // Remove Bearer from string
            token = token.slice(7, token.length);
        }
        console.log("Token: " + token);
        if (!token){
            console.log("No token provided");
            return res.status(401).send({'auth':false});
        } 

        jwt.verify(token, config.secret, function (err, decoded) {
            if (err){
                console.log("Token could not be verified");
                return res.status(401).send({'auth':false});
            } else {
                console.log("Token was valid");
                return res.status(200).send({'auth':true});
            }
        });
    });


// all other routes with get!!!
router.route('/*').get(function (req, res) {
    res.status(404).json('wrong path');
});



module.exports = router;


