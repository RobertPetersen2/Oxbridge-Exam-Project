
// BASE FOR THE SERVER 
var express = require('express');

var app = express();


// CORS headers inserted automatically  
const cors = require('cors');
app.use(cors());
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

// Authentication
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var config = require('./config/config');

const mongoClient = require("mongodb").MongoClient; // <- NEW 
const objectId = require("mongodb").ObjectID; // <- NEW 

var urlencode = bodyParser.urlencoded({ extended: true });
app.use(express.static('public'));
app.use(bodyParser.json());

const publicIp = require('public-ip');

// MONGO DB
const CONNECTION_URL = "mongodb://localhost:27017";
var DATABASE_NAME = 'oxbridgeDb';
var database, usersCollection;




// MODELS (NOTICE THIS IS IN ANOTHER FOLDER)
var User = require('./models/user');

// ROUTING
var router = express.Router();

// TO PROCESS THE NEXT REQUEST !!
router.use(function (req, res, next) {
    console.log("recieved a request now, ready for the next");
    next();
});


// THIS IS ONLY A TEST! NOT SURE IF IT WILL WORK!! 
var checkToken = function (req, res) {
    // Guard:
    let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
    if (token.startsWith('Bearer ')) {
        // Remove Bearer from string
        token = token.slice(7, token.length);
    }

    console.log("Token: " + token);
    if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });

    jwt.verify(token, config.secret, function (err, decoded) {
        if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    });
}


app.use('/', router); // here you could put in a prefix !!




router.route('/users')
    .post(async function (req, res) {

        checkToken(req, res);

        console.log('the object : ' + JSON.stringify(req.body));
        var user = req.body;

        // This function will check if the username even exists in the collection 
        usersCollection.findOne({ 'username': user.username }, { _id: 0, __v: 0 }, function (err, result) {
            if (err)
                res.send(err);

            if (result) {
                console.log("Found this (usersCollection): " + JSON.stringify(result));
                res.status(200).send({ message: "Username exists" })

            } else {
                res.status(500).json({ message: "Couldn't find this user" });

            }

        });

    })





router.route('/registration')

    .post(async function (req, res) {

        var hashedPassword = bcrypt.hashSync(req.body.password);
        console.log("Request: " + JSON.stringify(req.body));

        var user = new User(
            {
                fullName: req.body.fullName,
                username: req.body.username,
                password: hashedPassword,
                isTeamLeader: false,
                team: req.body.team
            });

        // This method will try to find a user in the Db with this username, to ensure that he doesn't already exist
        usersCollection.findOne({ 'username': user.username }, { _id: 0, __v: 0 }, function (err, result) {
            if (err) {
                res.send(err);
            }
            if (!result) {
                // If the username doesn't exist already (success scenario)

                usersCollection.insertOne(user, (error, result) => {
                    if (error) {
                        return res.status(500).send(error);
                    }

                    // create a token
                    var token = jwt.sign({ username: user.username }, config.secret, {
                        expiresIn: 86400 // expires in 24 hours
                    });

                    // Return a token to the client
                    res.status(201).json({ token: token, fullName: user.fullName, username: user.username, isTeamLeader: user.isTeamLeader, team: user.team });
                });

            } else {
                res.status(500).json("User already exist or some error happened");
            }
        });

    });

router.route('/login')
    .post(function (req, res) {
        console.log("Request: " + JSON.stringify(req.body));
        usersCollection.findOne({ 'username': req.body.username }, function (err, user) {
            if (err) return res.status(500).send('Error on the server.');
            if (!user) return res.status(404).send('No user found.');
            // This method will compare the password given in the request body with the one in the Db
            // The one from the request body is encrypted while performing this process 
            var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
            // If the password is invalid the 401 will be returned to the client
            if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });
            // Otherwise we will create a token
            var token = jwt.sign({ id: user.userName }, config.secret, {
                expiresIn: 86400 // expires in 24 hours
            });


            res.status(201).send({ token: token, fullName: user.fullName, username: user.username, isTeamLeader: user.isTeamLeader, team: user.team });

        });
    });

router.route('/validateToken')
    .get(function (req, res) {
        console.log("Request: " + JSON.stringify(req.body));
        checkToken(req, res);
        res.status(202).send({ auth: true, message: 'Token authenticated' })
    });



// all other routes with get!!!
router.route('/*').get(function (req, res) {
    res.status(404).json('wrong path');
});



// SERVER START : 3000 : process.env.PORT
app.listen(3000, () => {

    publicIp.v4().then(ip => {
        console.log("your public ip address", ip);
      });

    mongoClient.connect(CONNECTION_URL, { useNewUrlParser: true }, (error, client) => {
        if (error) {
            throw error;
        }
        database = client.db(DATABASE_NAME);
        usersCollection = database.collection("users");
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });

});

module.exports = app;  // important!!


