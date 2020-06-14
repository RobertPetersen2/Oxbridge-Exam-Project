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

// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var User = require('../models/user');
var Team = require('../models/team');
var Enrollment = require('../models/enrollments');

/**
 * POST method for appling for a team. (Creating an enrollment)
 */
router.route('/apply')
    .post(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            var isModifyingSelf = authorizationService.checkIfSameName(payload, req.body.username);

            if (!isAdmin && !isTeamLeader && isModifyingSelf) {

                var userError = false;
                var enrollment = new Enrollment(req.body);
                console.log('the object : ' + JSON.stringify(enrollment));

                usersCollection.findOne({ 'username': enrollment.username }, { _id: 0, __v: 0 }, function (err, user) {

                    if (err) {
                        userError = true;
                        return res.send(err);
                    }
                    if (!user) {
                        userError = true;
                        return res.status(406).send("This user doesn't exists! No user will be enrolled");
                    }
                    if (!userError) {
                        if (user.team == null) {
                            // We now know that the user exist, and that he hasn't got any team attached to him
                            // We also need to ensure that he is not already on the enrollment list
                            enrollmentCollection.findOne({ 'username': enrollment.username }, { _id: 0, __v: 0 }, function (err, enrolledUser) {
                                if (err) {
                                    return res.send(err);
                                }
                                if (enrolledUser) {

                                    return res.status(406).send("This user is already trying to apply for another team. Name: " + enrolledUser.team);
                                } else {
                                    // Now we know that he is not already on a waiting list for another team
                                    // Next thing we will do is check if the team he is trying to apply for exist. You cannot apply for a team that doesn't exist 
                                    var teamError = false;
                                    teamsCollection.findOne({ 'teamName': enrollment.team }, { _id: 0, __v: 0 }, function (err, team) {
                                        if (err) {
                                            teamError = true;
                                            return res.send(err);
                                        }
                                        if (!team) {
                                            teamError = true;
                                            return res.status(406).send("This team doesn't exists! No user will be enrolled");
                                        } else {
                                            enrollmentCollection.insertOne(enrollment, function (err) {
                                                if (err)
                                                    return res.send(err);
                                                return res.status(201).json(enrollment);
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            res.status(406).send("This user is already asigned to another team. Please leave that before you approve for another one");
                        }
                    }
                });

            } else {
                console.log("User is non entitled to apply for a team. This means that he is either a team leader (belongs to an existing team) or an admin (who cant be a part of a team)");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized, or is trying to enroll another user than himself" });
            }
        }
    });

/**
 * DELETE method for leaving the team you are already in 
 */
router.route('/leave')
    .delete(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
          //  var isModifyingSelf = authorizationService.checkIfSameName(payload, req.body.username);

            if (!isAdmin && !isTeamLeader) {

                // Set user.team to null AND remove his name from the team in the teamCollection
                // Remove him from the team JSON array - {teamName: user.team}, 

                usersCollection.findOneAndUpdate({ username: payload.username }, { $set: { team: null } }, { upsert: true }, function (err, user) {
                    if (err) { return res.status(406).send(err); }
                    else {
                        console.log("Removed team from user object");

                        // Remove him from the team JSON array - {teamName: user.team}, 
                        teamsCollection.findOneAndUpdate({ users: { $elemMatch: { username: payload.username } } }, { $pull: { users: { username: payload.username } } }, function (err) {
                            if (err) { return res.status(406).send(err); }
                            else {
                                console.log("Deleted user from team collection. (" + payload.username + " doesn't belong to the team anymore)");

                                // Also remove him from any enrollment lists just in case
                                enrollmentCollection.findOneAndDelete({ username: payload.username }, function (err) {
                                    if (err) { return res.status(406).send(err); }
                                    else {
                                        console.log("Removed any enrollment with this username so everything is clear");
                                        return res.status(200).send({ "user": payload.username, "team": "left" });
                                    }
                                });
                                // Nice to have. If any of the operations above would fail, it would be cool to have roll back function to revert changes
                            }
                        });
                    }
                });
            } else {
                console.log("User is non entitled to apply for a team. This means that he is either a team leader (belongs to an existing team) or an admin (who cant be a part of a team)");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized, or is trying to leave another team than his own" });
            }
        }
    });

/**
 * Check the status of the token bearers enrollment (is he in a team, is he waiting for a response, or isn't he in a team)
 */
router.route('/status')
    .get(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            //    var isModifyingSelf = authorizationService.checkIfSameName(payload, req.body.username);

            if (!isAdmin && !isTeamLeader) {

                // Check if user exists 
                usersCollection.findOne({ 'username': payload.username }, { _id: 0, __v: 0 }, function (err, user) {

                    if (err) {
                        return res.send(err);

                    }
                    if (!user) {
                        return res.status(406).send("This user doesn't exists! No user will be loaded");
                    } else {

                        if (user.team == null) {

                            // We know that the user is not in any teams, but we need to be sure that he isn't on a waiting list
                            enrollmentCollection.findOne({ username: payload.username }, function (err, enrollment) {
                                if (err) { return res.status(406).send(err); }
                                // If an enrollment object was found for this username, it means that he tried to enroll for a team (code 2)
                                if (enrollment) {
                                    return res.status(200).send({ "status": "User has no team, but is waiting for approval", "code": 2 });
                                }
                                else {
                                    // If no enrollment object was found, he doesn't have any teams
                                    return res.status(200).send({ "status": "No team attached to this user", "code": 1 });
                                }
                            });
                        } else {
                            return res.status(200).send({ "status": "User is already in a team", "teamName": user.team, "code": 3 });
                        }
                    }
                });
            } else {
                console.log("This particular user cannot check status of his participation. This is probably because he is either a team leader or an admin");
                res.status(401).json({ auth: false, message: "This particular user cannot check status of his participation. This is probably because he is either a team leader or an admin" });
            }
        }
    });

/**
 * Fetch a list of pending approvals, but only for the team of the owner of the token, which has to be a Team Leader
 */
router.route('/pending')
    .get(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);

            // Only team leaders can see pending approvals
            if (isTeamLeader) {

                // Retreive list of pending approvals (participant enrollments)
                // And make sure its only the team leaders team
                enrollmentCollection.find({ "team": payload.team }).toArray(function (err, enrollments) {
                    if (err) return res.status(500).send('Error on the server.');
                    if (!enrollments) return res.status(404).send('No teams found.');

                    res.status(201).send(enrollments);
                });
            } else {
                console.log("User is non entitled to see pending approvals.");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized, or not entitled to see this data" });
            }
        }
    });

/**
 * Accept/Reject an enrollment
 */
router.route('/manageApproval')
    .post(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            // We need to check what kind of user is trying to perform this CRUD action and what permissions he has
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);

            // Only team leaders can see pending approvals
            if (isTeamLeader) {

                // Team leaders decision about the enrollment (approve or deny = true or false)
                var accept = req.body.accept;
                // The enrollment object
                var enrollment = new Enrollment({
                    team : req.body.team,
                    username : req.body.username
                });

                // Check that the enrollment is on team leaders team
                if (payload.team == enrollment.team) {
                    // Check that there is a pending approval on this team with this user
                    enrollmentCollection.findOne({ "team": payload.team, "username": enrollment.username }, function (err, enrollments) {
                        if (err) return res.status(500).send('Error on the server.');
                        if (!enrollments) {
                            return res.status(404).send({ "action": "failed", "message": "Could not find the enrollment you are trying to process" });
                        } else {
                            // If an enrollment was found, WHICH it should. We will continue to next step

                            // Lets start off by removing the enrollment
                            enrollmentCollection.deleteOne({ username: enrollment.username }, function (err) {
                                if (err) { return res.status(406).send(err); }
                                else {
                                    console.log("Removed any enrollment with this username so everything is clear");

                                    // If Team Leader accepted the approval, user will be added to the team he signed up for 
                                    if (accept) {

                                        // Find and update the teams collection by adding the user to the particular team
                                        teamsCollection.findOneAndUpdate({ teamName: payload.team },
                                            { $push: { users: { username: enrollment.username, isTeamLeader: false} } }, { upsert: true }
                                            , function (err, team) {
                                                if (err) {
                                                    return res.status(500).send(err)
                                                } else {
                                                    // next things is to find and update the user
                                                    usersCollection.findOneAndUpdate({ username: enrollment.username }, { $set: { team: enrollment.team  } }, { upsert: true }, function (err, doc) {
                                                        if (err) { throw err; }
                                                        else {
                                                            console.log("Updated user item");

                                                            return res.status(200).send({ "action": "success", "message": "User has been approved to the team of the teamleader", "team": enrollment.team })
                                                        }
                                                    });
                                                }
                                            });
                                    } else {
                                        return res.status(200).send({"action":"success","message":"Application has been denied. Enrollment object was removed only"});
                                    }
                                }
                            });
                        }
                    });

                    // If yes ->

                    // Check if team leader accepted the application and then add the user to the team list AND set his team name in users

                    // If he denied the application, he should not do anything, but the enrollment should still be tossed away

                    // Remove the enrollment no matter what
                }
            } else {
                console.log("User is non entitled to see pending approvals.");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized, or not entitled to see this data" });
            }
        }
    });

// all other routes with get!!!
router.route('/*').get(function (req, res) {
    res.status(404).json('wrong path');
});


module.exports = router;


