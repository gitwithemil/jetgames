import test from 'node:test';
import assert from 'node:assert/strict';
import {createGait,proximityStrength} from '../dist/enemy-motion.js';
import {createGameRuntime} from './helpers/game-runtime.mjs';

test('gait follows movement speed, holds its phase when stopped and settles to idle',()=>{
 const gait=createGait();gait(0,1);let walk;
 for(let n=1;n<30;n++)walk=gait(n*.05,1);
 assert(walk.weight>.9);const phase=walk.phase;
 for(let n=30;n<100;n++)walk=gait(n*.05,0);
 assert.equal(walk.phase,phase);assert(walk.weight<.001);
 const slow=createGait(),fast=createGait();slow(0,1);fast(0,2);
 assert(fast(.05,2).phase>slow(.05,1).phase);
});

test('proximity warning increases smoothly, clamps, and can be suppressed',()=>{
 assert.equal(proximityStrength(12),0);assert.equal(proximityStrength(50),0);
 assert(proximityStrength(5)>proximityStrength(10));assert.equal(proximityStrength(0),1);
 assert.equal(proximityStrength(0,false),0);
});

test('warning appears for a nearby enemy, respects reduced effects and disappears on pause and menu',async t=>{
 const g=await createGameRuntime();t.after(()=>g.dispose());const {qa,element}=g;
 await qa.start(0);qa.skipTraining();qa.setSetting('scares',false);qa.setSetting('reducedEffects',true);
 qa.advance(30);const enemy=qa.actors[0];qa.actors.slice(1).forEach(a=>a.stunnedUntil=Infinity);
 const player=qa.state.player;enemy.model.group.position.set(player[0],0,player[2]-5);
 g.frames(1);assert.equal(element('proximity-cue').hidden,false);assert.match(element('proximity-label').textContent,/CLOSE/);
 assert(element('proximity-cue').classList.contains('still'));
 qa.pause();assert.equal(element('proximity-cue').hidden,true);qa.resume();g.frames(1);assert.equal(element('proximity-cue').hidden,false);
 qa.menu();assert.equal(element('proximity-cue').hidden,true);
});
