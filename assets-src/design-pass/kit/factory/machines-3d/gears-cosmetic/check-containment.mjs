import assert from 'node:assert/strict';import{contain}from './containment.mjs';
assert.equal(contain([[.9,.068,0],[.29,.098,0],[.28,.098,.01]],[0,1,2],1).pass,false,'Individually contained vertices can bridge outside the union');
assert.equal(contain([[.9,.069,0],[.8,.069,.01],[.8,.069,-.01]],[0,1,2],1).pass,true,'The rim boundary includes its full radius');
assert.equal(contain([[.99,0,0],[.9,.01,.1],[.8,-.03,0]],[0,1,2],1).pass,true);
console.log('Containment edge cases passed');
