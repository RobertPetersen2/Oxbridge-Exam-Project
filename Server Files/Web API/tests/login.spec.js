let mongoose = require("mongoose");
let User = require('../models/user');

//Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../server2'); // our server.js
let should = chai.should();
var assert = require('chai').assert;
letexpect = require('chai').expect;


chai.use(chaiHttp);

// Test data
var correctUsername = "LukasMendez";
var correctPassword = "123456";
var wrongUsername = "Xcxkewlk32";
var wrongPassword = "dsjvdfslkf";


describe('POST - /login with different input', () => {
    // Wrong username and password
      it('TEST # 1 - should display an error', (done) => {
        chai.request(server)
            .post('/authentication/login')
            .send({'username':wrongUsername, 'password':wrongPassword})
            .end((err, res) => {
                  res.should.have.status(404);
                  let expectedMessage = {'message':'No user found.'};
                  res.body.should.eql(expectedMessage);
              done();
            });
      });
    // Wrong username and correct password
      it('TEST # 2 - should display an error', (done) => {
        chai.request(server)
            .post('/authentication/login')
            .send({'username':wrongUsername, 'password':correctPassword})
            .end((err, res) => {
                  res.should.have.status(404);
                  let expectedMessage = {'message':'No user found.'};
                  res.body.should.eql(expectedMessage);
              done();
            });
      });
    // Correct username and wrong password
      it('TEST # 3 - should display an error', (done) => {
        chai.request(server)
            .post('/authentication/login')
            .send({'username':correctUsername, 'password':wrongPassword})
            .end((err, res) => {
                  res.should.have.status(401);
                  let expectedMessage = {'message': 'Wrong password'};
                  res.body.should.eql(expectedMessage);
              done();
            });
      });
    // Correct username and password
      it('TEST # 4 - should return 201 success with token and login info', (done) => {
        chai.request(server)
            .post('/authentication/login')
            .send({'username':correctUsername, 'password':correctPassword})
            .end((err, res) => {
                 res.should.have.status(201);
                 res.body.should.have.property('token');
                 res.body.should.have.property('isAdmin');
                 res.body.should.have.property('isTeamLeader');
                 assert.typeOf(res.body.isAdmin, 'Boolean');
                 assert.typeOf(res.body.isTeamLeader, 'Boolean');
                 res.body.should.have.property('team');
                 res.body.should.have.property('username').with.lengthOf(correctUsername.length);
                                   
              done();
            });
      });
});