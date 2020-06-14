// BASE FOR THE SERVER 
var express = require('express');

// Routing
var router = express.Router();

// Token / Guards
var authorizationService = require('../services/authorizationService');

// MongoDB service
const dbService = require('../services/dbService');
var database = dbService.getDb();
var teamsCollection = database.collection("teams");
var usersCollection = database.collection("users");
var enrollmentCollection = database.collection("enrollment");
var racesCollection = database.collection("races");

// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var User = require('../models/user');
var Team = require('../models/team');
var Enrollment = require('../models/enrollments');

/**
 * GET to fetch all the teams in the database
 */
router.route('/')
    .get(function (req, res) {

        // Guard that will check the token before letting the user use this
        var payload = authorizationService.checkToken(req, res);
        if (payload) {
            var isAdmin = authorizationService.checkIfAdmin(payload);

            if (isAdmin) {
                // Load all the teams and return them as JSON in the response 
                teamsCollection.find({}).toArray(function (err, teams) {
                    if (err) return res.status(500).send('Error on the server.');
                    if (!teams) return res.status(404).send('No teams found.');

                    res.status(201).send(teams);
                });

            } else {
                // Load the team of the team leader or attendant
                var teamOfTeamLeader = payload.team;

                // If it is a registered user, but someone who is not attending in any team it should just return an error / no result
                teamsCollection.findOne({ teamName: teamOfTeamLeader }, function (err, teams) {
                    if (err) return res.status(500).send('Error on the server.');
                    if (!teams) return res.status(404).send('No team found.');
                    console.log(teams);

                    res.status(201).send(teams);
                });
            }
        } else {
            res.status(401).json({ auth: "false", isAdmin: false });
        }
    });

/**
 * POST used for specifying which team to delete
 */
router.route('/deleteTeam')
    .post(function (req, res) {
        var teamError = false;
        // Guard that will check the token before letting the user use this
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            // Delete a team if you are admin OR if you are a team leader and the team you are trying to delete, belong to you
            if (isAdmin || (isTeamLeader && req.body.teamName === payload.team)) {
                // Delete by name

                var team = new Team(
                    {
                        teamName: req.body.teamName
                    });

                // First we will find the team itself
                teamsCollection.findOne({ 'teamName': team.teamName }, { _id: 0, __v: 0 }, function (err, result) {
                    if (err) {
                        teamError = true;
                        return res.send(err);
                    }
                    if (!result) {
                        teamError = true;
                        return res.status(406).send("This team name doesn't exists! Please use another one");
                    }
                    // Deletion will only occour if there was a result and no errors
                    if (!teamError) {
                        // Delete the team document found
                        teamsCollection.deleteOne(result, function (err, obj) {
                            if (err) { throw err; }
                            console.log("1 document deleted");

                            // We also need to ensure, that all team members including the team leader will be removed from the team in the users collection
                            var userError = false;

                            usersCollection.find({ 'team': result.teamName }, { _id: 0, __v: 0 }, function (err, users) {
                                if (err) {
                                    userError = true;
                                    return res.send(err);

                                }
                                if (!users) {
                                    userError = true;
                                    return res.status(406).send("No users with that team exists! No user will be deleted");
                                }

                                if (!userError) {
                                    // This will be the updated values, that we want to insert

                                    usersCollection.updateMany({ "team": result.teamName }, { $set: { "isTeamLeader": false, "team": null } }, function (err) {
                                        if (err) {
                                            return res.send(err);

                                        } else {
         
                                            console.log("Removed any enrollment with this team so everything is clear");

                                            // Also remove any enrollments of people who were trying to join this team
                                            enrollmentCollection.deleteMany({ team: team.teamName }, function (err) {
                                                if (err) { return res.status(406).sende(err); }
                                                else {

                                                    // Remove the team from any races as well 
                                                    racesCollection.updateMany({ assignedTeams: { $elemMatch: { teamName: team.teamName } } }, { $pull: { assignedTeams: { teamName: team.teamName } } } ,function (err, info) {
                                                        if (err) { return res.status(406).send(err); }
                                                        else if (!info) {
                                                            
                                                            return res.status(200).send({ 'action': 'success' });
                                                        }
                                                        else {
                                                            return res.status(406).send({ "action": 'failed' });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        });
                    }
                });
            } else {
                console.log("User is not an admin");
                res.status(401).json({ auth: "false", isAdmin: false });
            }
        }
    });

    /**
     * GET to see which teams there are available for a user who wants to join a team
     */
router.route('/availableTeams')
    .get(function (req, res) {

        // Guard that will check the token before letting the user use this
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // Load all the teams and return them as JSON in the response 
            teamsCollection.find({}, { projection: { _id: 0, "users": 0 } }).toArray(function (err, teams) {
                if (err) return res.status(500).send('Error on the server.');
                if (!teams) return res.status(404).send('No teams found.');

                res.status(201).send(teams);
            });

        } else {
            res.status(401).json({ auth: "false" });
        }
    })

    /**
     * GET: Retreive the team of the token owner
     */
router.route('/yourTeam')
    .get(function (req, res) {

        // Guard that will check the token before letting the user use this
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // Load all the teams and return them as JSON in the response 
            usersCollection.findOne({ "username": payload.username }, { projection: { _id: 0, "users": 0 } }, function (err, user) {
                if (err) return res.status(500).send('Error on the server.');
                if (!user) return res.status(404).send('No user found.');

                res.status(201).send({ "team": user.team });
            });

        } else {
            res.status(401).json({ auth: "false" });
        }
    })


/**
 * POST: This is in fact used for deleting a participant. Admins can remove all, Team Leaders can only remove those from his own team
 */
router.route('/participant')
    .post(function (req, res) {
        var teamError = false;
        // Guard that will check the token before letting the user use this
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);

            // Will usually just be 'null' if he is an admin
            var teamLeadersTeam = payload.team;

            if (isAdmin || isTeamLeader) {
                // Delete by name
                var user = new User({
                    team: req.body.teamName,
                    username: req.body.username
                });

                // If the user is a Team Leader we need to ensure that he is removing someone from the team he owns
                // UNLESS he is an admin, he can delete everyone he wants
                if (teamLeadersTeam == user.team || isAdmin) {

                    // Update user document, so that he doesn't belong to any team any more
                    usersCollection.findOneAndUpdate({ username: user.username }, { $set: { team: null } }, { upsert: true }, function (err, doc) {
                        if (err) { throw err; }
                        else { console.log("Updated user item"); }

                        // Remove him from the team JSON array - {teamName: user.team}, 
                        teamsCollection.findOneAndUpdate({ users: { $elemMatch: { username: user.username } } }, { $pull: { users: { username: user.username } } }, function (err) {
                            if (err) { throw err; }
                            else {
                                console.log("Deleted user from team collection. (" + user.username + " doesn't belong to the team anymore)");
                                return res.status(200).send({ action: "success" });
                            }
                        });
                    });
                }
            } else {
                console.log("User is not an admin");
                res.status(401).json({ auth: "false", isAdmin: false });
            }
        }
    });


// all other routes with get!!!
router.route('/*').get(function (req, res) {
    res.status(404).json('wrong path');
});


module.exports = router;


