// BASE FOR THE SERVER 
var express = require('express');

// Routing
var router = express.Router();

// MongoDB service
const dbService = require('../services/dbService');
var database = dbService.getDb();
var racesCollection = database.collection("races");
var teamsCollection = database.collection("teams");

// Token / Guards
var authorizationService = require('../services/authorizationService');
var raceService = require('../services/raceService');

// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var Race = require('../models/race');
var Team = require('../models/team');


router.route('/')
/**
 * GET: Find all races from the database
 */
    .get(function (req, res) {
        
        racesCollection.find({}, { projection: { _id: 0, "checkPoints._id": 0 } }).toArray(function (err, races) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).json(races);
            }
        });
    }
    )

    /**
     * POST: Add a new race OR change an existing one
     */
    .post(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isAdmin) {
                var race = new Race(req.body);
                delete race._id;
                console.log('the object : ' + JSON.stringify(race));
                if (race.startTime == null) { race.startTime = "1899-12-31T23:59:59.000Z" }

                racesCollection.findOne({ "raceID": race.raceID }, { _id: 0, __v: 0 }, function (err, raceFound) {
                    if (err) {
                        return res.status(500).send(err)
                    } else if (raceFound) {
                        // If the mongo client found an existing record with this raceID, everything will be overwritten
                        console.log("Found race with this raceID. Trying to replace the data");
                        console.log(raceFound);
                        racesCollection.update({ "raceID": raceFound.raceID }, {
                            $set:
                            {
                                startTime: race.startTime,
                                locationDescription: race.locationDescription,
                                checkPoints: race.checkPoints,
                                laps: race.laps
                            }
                        }, function (err) {
                            if (err) {
                                return res.send(err);
                            }
                            res.status(201).json({ "updatedRace": true });
                        });

                    } else {
                        // If the mongo client didn't find a matching object with this race ID we assume that the user is creating a new race
                        console.log("No race with that raceID would found. Creating new object");
                        // To ensure that this is the case, we created a rule stating that the raceID has to be -1. This is interpreted as a command to create a new race
                        if (race.raceID == -1) {
                            // We are not NOT using auto increment. Therefore we need to find the highest raceID ourselves first
                            racesCollection.find().sort({ raceID: -1 }).limit(1).toArray(function (err, result) {
                                if (err) { console.log("ERROR FINDING MAX") } else {
                                    var first = result[0];
                                    console.log("Highest raceID so far: " + first.raceID);
                                    var newRaceID = first.raceID + 1;
                                    console.log("New RaceID: " + newRaceID);
                                    race.raceID = newRaceID;
                                    racesCollection.insertOne(race, function (err) {
                                        if (err)
                                            return res.send(err);
                                        res.status(201).json({ "newRaceAdded": true, "newRaceID": newRaceID });
                                    });
                                }
                            });

                        } else {
                            return res.status(500).send("Sorry, but your request was not accepted as a command to create a new race. Please use -1 as raceID in order to create a new object");
                        }
                    }
                });
            } else {
                console.log("The user trying to post a race is not an admin");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized and cannot post races" });
            }
        }
    });


/**
 * POST: Start the race by raceID
 */
router.route('/startRace/:id')
    .post(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isAdmin) {
                raceService.beginRace(req.params.id);
                return res.status(200).send({'startedRace': true, 'message': "raceID " + req.params.id + " was started"});
            }
            return res.status(401).send({'startedRace': false, 'message':'User is not authorized'});
        }
    });

/**
 * POST: IN-PROGRESS: Stop a race
 */
router.route('/stopRace/:id')
    .post(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isAdmin) {
                // raceService.beginRace(req.params.id);
                // return res.status(200).send({'startedRace': true, 'message': "raceID " + req.params.id + " was started"});
            }
            return res.status(401).send({ 'startedRace': false, 'message': 'User is not authorized' });
        }
    });

/**
 * POST: IN-PROGERSS: Check if there is an ongoing race, and return an answer to the client
 */
router.route('/isThereARaceNow')
    .post(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isAdmin) {
                // raceService.beginRace(req.params.id);
                // return res.status(200).send({'startedRace': true, 'message': "raceID " + req.params.id + " was started"});
            }
            return res.status(401).send({ 'startedRace': false, 'message': 'User is not authorized' });
        }
    });

    /**
     * Remove a team from a raceID
     */
router.route('/removeTeam/:id')
    .post(function (req, res) {

        var raceId = parseInt(req.params.id);
        var teamToDelete = req.body.teamName;

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            if (isAdmin || isTeamLeader) {

                racesCollection.findOne({ "raceID": raceId }, { _id: 0, __v: 0 }, function (err, race) {
                    if (err) {
                        return res.status(500).send(err);
                    } else if (!race) {
                        return res.status(500).send("Race does not exist!");
                    } else {
                        // At this point we assume that the race exist
                        // We want to check if the race contains the team we want to delete
                        var containsTeam = false;
                        // We iterate through the array of teams to see if its even there
                        for (var i = 0; i < race.assignedTeams.length; i++) {

                            if (race.assignedTeams[i].hasOwnProperty("teamName") && race.assignedTeams[i]["teamName"] === teamToDelete) {
                                // it happened.
                                containsTeam = true;
                                break;
                            }
                        }

                        console.log("Race contains team: " + containsTeam);
                        if (!containsTeam) {
                            return res.status(500).send("This race does not contain the team you are trying to delete");
                        } else {

                            // If the user is a team leader, and NOT an admin. We want to make sure, that he is not deleting someone elses team from a race
                            // He must only be a team leader deleting his own team, OR an admin 
                            if ((isTeamLeader && !isAdmin && payload.team === teamToDelete) || isAdmin) {
                                console.log("This particular user has permission to delete the following team: " + teamToDelete);

                                // Remove the team from the team JSON array - {teamName: teamToDelete} 
                                racesCollection.findOneAndUpdate({ assignedTeams: { $elemMatch: { teamName: teamToDelete } } }, { $pull: { assignedTeams: { teamName: teamToDelete } } }, function (err) {
                                    if (err) { throw err; }
                                    else {
                                        console.log("Deleted team from team collection. (" + teamToDelete + " doesn't belong to raceID: " + raceId + "anymore)");
                                        return res.status(200).send({ action: "success" });
                                    }
                                });

                            } else {
                                return res.status(500).send("Sorry this operation could not be done. This person is not entitled to remove this team. It may be because he is a team leader, who is trying to remove someone elses team from the race. Shame on you!");
                            }
                        }
                    }
                })
            } else {
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized and cannot delete teams" });
            }
        }
    });

/**
 * This method is for team leaders, to see which races they have been assigned to
 * */ 
router.route('/assignedRaces')
    .get(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            if (isTeamLeader) {
                racesCollection.find({ assignedTeams: { $elemMatch: { teamName: payload.team } } }, { projection: { _id: 0, "checkPoints._id": 0 } }).toArray(function (err, races) {
                    if (err) {
                        res.status(500).send(err);
                    } else {
                        res.status(200).json(races);
                    }
                });
            } else {
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized or not allowed to do this" });
            }
        }
    });

    /**
     * GET: To see which races are available for the team of the token holder
     */
    router.route('/availableRaces')
    .get(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            if (isTeamLeader) {
                racesCollection.find({ assignedTeams: {
                    "$not": { $elemMatch: { teamName: payload.team } }
                } }, { projection: { _id: 0, "checkPoints._id": 0 } }).toArray(function (err, races) {
                    if (err) {
                        res.status(500).send(err);
                    } else {
                        res.status(200).json(races);
                    }
                });
            } else {
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized or not allowed to do this" });
            }
        }

    });

    /**
     * GET: Fetch a sorted leaderboard of the current race
     */
    router.route('/leaderboard')
    .get(function (req, res) {
        var json = raceService.getSortedLeaderboard();
        res.status(200).json(json);
    });




    /**
     * POST: Assign a team to a race (Admin only)
     */
    router.route('/assignTeam')
    .post(function (req, res) {
        var payload = authorizationService.checkToken(req, res);

        var teamName_ = req.body.teamName;
        var raceID_ = req.body.raceID;
        var teamFound;
        var myteam = new Team({
            teamName: teamName_
        })
        if (payload) {

            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isTeamLeader || isAdmin) {
                //make sure the raceID exists
                racesCollection.find({ raceID: raceID_ }).limit(1).next(function (err, raceFound) {
                    if (raceFound != null) { //if race exists

                        //Make sure the team to assign exists
                        teamsCollection.find({
                            teamName: teamName_
                        }).limit(1).next(function (err, teamFound) {
                            if (teamFound != null) { //if team exists
  
                                //Make sure the element doesnt already exist
                                racesCollection.find({
                                    raceID: raceID_, assignedTeams: {
                                        $elemMatch: { teamName: myteam.teamName }
                                    }
                                }).limit(1).next(function (err, doc) {

                                    if (doc == null) {
                                        //Update the element in the array
                                        racesCollection.findOneAndUpdate({ raceID: raceID_ }, //the race to update
                                            { $push: { assignedTeams: myteam } }, { upsert: false }
                                            , function (err, myteam) {
                                                if (err) {
                                                    //console.log("error2");
                                                    return res.status(500).send(err)
                                                } else {
                                                    return res.status(200).send({ "action": "success", "message": "teamName added: " + teamName_, "race": raceID_ })
                                                }
                                            });
                                    } else {
                                        //console.log("teamName already assigned")
                                        return res.status(500).send("teamName already assigned")
                                    }
                                })
                            } else {
                                return res.status(500).send("teamName doesnt exist")
                            }
                        })
                    } else {
                        return res.status(500).send("raceID doesnt exist")
                    }
                })
            } else {
                return res.status(500).send("must be either teamLeader or Admin")
            }
        }
    });


    /**
     * POST: Join a race as team leader
     */
router.route('/joinRace')
    .post(function (req, res) {
        var payload = authorizationService.checkToken(req, res);
        var raceID_ = req.body.raceID;
        if (payload) {

            var isTeamLeader = authorizationService.checkIfTeamLeader(payload);
            if (isTeamLeader) {
                racesCollection.find({raceID: raceID_, assignedTeams: {$elemMatch: { teamName: payload.team } } //checking if this guys team is assigned to this raceID
                }).limit(1).next(function (err, doc) {
                    if (doc != null) { //if team found
                        return res.status(200).send({ "access": true, "message": "user is participating in this race" })
                    } else {
                        return res.status(200).send({ "access": false, "message": "user is not participating in this race" })
                    }
                })
            } else {
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized or not allowed to do this" });
            }
        }
    });



router.route('/:id')
    /**
     * GET: Get a specific raceID
     */
    .get(function (req, res) {

        console.log("Race ID: " + req.params.id);
        var raceId = parseInt(req.params.id);
        if(raceId > 1000){
            racesCollection.findOne({ 'raceID': raceId }, { projection: { _id: 0, "checkPoints._id": 0 } }, function (err, race) {
                if (err) {
                    res.status(500).send(err);
                } else {
                    res.status(200).json(race);
                }
            });
        } else {
            res.status(406).send({"message":"Please specify a valid raceID"});
        }
    })
    /**
     * DELETE: Delete a race by ID
     */
    .delete(function (req, res) {

        var payload = authorizationService.checkToken(req, res);
        if (payload) {

            var isAdmin = authorizationService.checkIfAdmin(payload);
            if (isAdmin) {
                console.log("Race ID: " + req.params.id);
                var raceId = parseInt(req.params.id);
                racesCollection.findOneAndDelete({ raceID: raceId }, function (err, info) {
                    console.log(info);
                    if (err) { return res.status(406).send(err); }
                    else if (info.value !== null) {
                        return res.status(200).send({ "removed": true })
                    }
                    else {
                        return res.status(406).send({ "removed": false });
                    }
                });
            } else {
                console.log("The user trying to delete a race is not an admin");
                res.status(401).json({ auth: false, isAdmin: false, message: "User is either not authorized and cannot delete races" });
            }
        }
    });

// all other routes with get!!!
router.route('/*').get(function (req, res) {
    res.status(404).json('wrong path');
});

module.exports = router;
