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
var IN = 1006;
var OUT = 24;
var ON = 1001;
var OFF = 1000; 


describe('POST - /races with different raceIDs (domain analysis) - condition (raceID > 1000)', () => {
    // IN the domain
      it('TEST # 1 - should return a success', (done) => {
        chai.request(server)
            .get('/races/' + IN)
            .end((err, res) => {
                  res.should.have.status(200);
                  // More elaborative testing could be added here
              done();
            });
      });   
    // OUT of the domain
      it('TEST # 2 - should return an error', (done) => {
        chai.request(server)
            .get('/races/' + OUT)
            .end((err, res) => {
                  res.should.have.status(406);
                  let expectedMessage = {"message":"Please specify a valid raceID"};
                  res.body.should.eql(expectedMessage);
              done();
            });
      });
    // ON the domain (border of the valid class)
      it('TEST # 3 - should return a success', (done) => {
        chai.request(server)
            .get('/races/' + ON)
            .end((err, res) => {
                res.should.have.status(200);
                // More elaborative testing could be added here
              done();
            });
      });
      it('TEST # 4 - should return an error', (done) => {
    // OFF the domain (border of valid class -1)
        chai.request(server)
            .get('/races/' + OFF)
            .end((err, res) => {
                res.should.have.status(406);
                let expectedMessage = {"message":"Please specify a valid raceID"};
                res.body.should.eql(expectedMessage);
              done();
            });
      });
});