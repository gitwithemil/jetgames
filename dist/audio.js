// Generated room tone and restrained horror cues. Creation alone is silent.
export function createAudio() {
  let ctx=null, master=null, ambient=null, buzzGain=null, hissGain=null, noiseBuffer=null;
  let volume=.38, paused=false, disposed=false, initialized=false;
  let nextKnock=5, nextBeat=0, lastStep=-100, lastCrank=-100, time=0;
  let captionHandler=()=>{};
  const live=new Set();
  const loops=[];
  const state={distance:100,chasing:false,moving:false,sprinting:false,enemyType:"sahur",level:0};

  function noise(duration=2) {
    const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
    const d=b.getChannelData(0);
    let previous=0;
    for(let i=0;i<d.length;i++) {
      const white=Math.random()*2-1;
      previous=(previous+.025*white)/1.025;
      d[i]=previous*3.5;
    }
    return b;
  }
  function track(node,...cleanup) {
    live.add(node);
    node.onended=()=>{
      live.delete(node);
      for(const item of [node,...cleanup])try{item.disconnect();}catch{}
    };
    return node;
  }
  function gainEnvelope(at,duration,level,attack=.005) {
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,level),at+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    gain.connect(master); return gain;
  }
  function tone(frequency,at,duration,level,type='sine',endFrequency=null) {
    const oscillator=ctx.createOscillator();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,at);
    if(endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);
    const envelope=gainEnvelope(at,duration,level,.007);
    oscillator.connect(envelope);track(oscillator,envelope);
    oscillator.start(at); oscillator.stop(at+duration+.02);
  }
  function filteredNoise(at,duration,level,frequency,q=.7,pan=0) {
    const source=ctx.createBufferSource(); source.buffer=noiseBuffer;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
    const envelope=gainEnvelope(at,duration,level,.003);
    source.connect(filter);
    let panner=null;
    if(ctx.createStereoPanner) {
      panner=ctx.createStereoPanner();panner.pan.value=pan;
      filter.connect(panner);panner.connect(envelope);
    } else filter.connect(envelope);
    track(source,...[filter,envelope,panner].filter(Boolean));
    source.start(at,Math.random()*.6,duration);source.stop(at+duration+.02);
  }
  function available(){return initialized&&!paused&&!disposed&&ctx?.state==='running';}

  async function init() {
    if(disposed) return;
    if(!ctx) {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext) return;
      ctx=new AudioContext();
      master=ctx.createGain(); master.gain.value=paused?0:volume;
      const compressor=ctx.createDynamicsCompressor();
      compressor.threshold.value=-18; compressor.knee.value=20;
      compressor.ratio.value=5; compressor.attack.value=.012; compressor.release.value=.22;
      master.connect(compressor);compressor.connect(ctx.destination);
      noiseBuffer=noise();
      ambient=ctx.createGain();ambient.gain.value=.85;ambient.connect(master);
      buzzGain=ctx.createGain();buzzGain.gain.value=.026;buzzGain.connect(ambient);
      for(const [frequency,amplitude] of [[60,.64],[120,.22],[180,.06],[29.7,.23]]) {
        const oscillator=ctx.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;
        const g=ctx.createGain();g.gain.value=amplitude;
        oscillator.connect(g);g.connect(buzzGain);oscillator.start();loops.push(oscillator);
      }
      hissGain=ctx.createGain();hissGain.gain.value=.030;hissGain.connect(ambient);
      const source=ctx.createBufferSource();source.buffer=noiseBuffer;source.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.5;
      source.connect(filter);filter.connect(hissGain);source.start();loops.push(source);
      // A slow fluorescent ballast pulse is felt more than heard.
      const lfo=ctx.createOscillator();lfo.frequency.value=.14;
      const lfoGain=ctx.createGain();lfoGain.gain.value=.006;
      lfo.connect(lfoGain);lfoGain.connect(buzzGain.gain);lfo.start();loops.push(lfo);
      initialized=true;
    }
    if(!paused&&ctx.state==='suspended') {
      try{await ctx.resume();}catch{}
    }
  }

  function knock(announce=true) {
    if(!available())return;
    if(announce)captionHandler('Three hollow knocks echo through the halls.');
    const near=Math.max(0,1-state.distance/25);
    const level=.024+near*.105;
    const pan=Math.sin(time*.23)*(1-near)*.48;
    const at=ctx.currentTime;
    for(let i=0;i<3;i++) {
      const t=at+i*.145;
      tone(176+i*3,t,.18,level,'sine',76);
      tone(413-i*8,t,.075,level*.20,'sine',290);
      filteredNoise(t,.065,level*.35,1050,.85,pan);
    }
  }
  function entityCue(type='sahur'){
    if(!available())return;
    const captions={sahur:'Three hollow knocks echo through the halls.',ballerina:'A thin, wavering melody rings nearby.',bribri:'A low growl rumbles nearby.',spioniro:'A sharp electronic chirp cuts through the silence.',bombardino:'A heavy engine-like drone approaches.',smiler:'A high, wavering hum hangs in the air.',hound:'A guttural growl sounds nearby.',watcher:'A faint static hiss rises nearby.'};
    captionHandler(captions[type]||'A strange sound echoes nearby.');
    if(type==='sahur'){knock(false);return;}
    const at=ctx.currentTime,near=Math.max(0,1-state.distance/28),level=.025+near*.07;
    if(type==='ballerina'){[880,698,1046].forEach((f,i)=>tone(f,at+i*.11,.24,level*.45,'triangle',f*.94));}
    if(type==='bribri'){tone(205,at,.24,level*.8,'sawtooth',75);filteredNoise(at,.15,level*.7,900,2);}
    if(type==='spioniro'){filteredNoise(at,.045,level,3200,1);filteredNoise(at+.09,.06,level*.7,2300,1.5);}
    if(type==='bombardino'){tone(94,at,.65,level*.8,'sawtooth',72);tone(191,at,.6,level*.25,'triangle',150);}
    if(type==='smiler'){tone(930,at,.65,level*.5,'sine',530);tone(957,at+.05,.6,level*.4,'sine',610);filteredNoise(at,.45,level*.6,2800,2);}
    if(type==='hound'){tone(78,at,.55,level,'sawtooth',40);filteredNoise(at,.65,level,260,1.4);}
    if(type==='watcher'){filteredNoise(at,.55,level,680,3);tone(128,at,.7,level*.7,'triangle',92);}
  }
  function heartbeat() {
    const at=ctx.currentTime;
    const close=Math.max(0,1-state.distance/11);
    captionHandler('A heartbeat pounds in your ears.');
    for(const offset of [0,.155]) tone(65,at+offset,.15,.025+close*.038,'sine',38);
  }
  function update({distance=100,moving=false,sprinting=false,chasing=false,enemyType='sahur',level=0,dt=0}={}) {
    state.distance=Number.isFinite(distance)?Math.max(0,distance):100;
    state.enemyType=enemyType;state.level=level;state.moving=!!moving;state.sprinting=!!sprinting;state.chasing=!!chasing;
    if(!available()) return;
    time+=Math.min(.15,Math.max(0,Number(dt)||0));
    const close=Math.max(0,1-state.distance/18);
    buzzGain.gain.setTargetAtTime(.025+Math.sin(time*.49)*.003+close*.008,ctx.currentTime,.4);
    hissGain.gain.setTargetAtTime(.028+(state.level===1?.015:0)+close*.017+(chasing?.008:0),ctx.currentTime,.5);
    if(time>=nextKnock) {
      entityCue(state.enemyType);nextKnock=time+(chasing?1.75:4.8)+Math.random()*(chasing?.75:3.5);
    }
    if((state.distance<11||chasing)&&time>=nextBeat) {
      heartbeat();nextBeat=time+(chasing?.67:1.18)-close*.14;
    }
  }
  function step(sprinting=false) {
    if(!available()||ctx.currentTime-lastStep<.12)return;
    lastStep=ctx.currentTime;
    captionHandler(sprinting?'Your footsteps pound against the floor.':'Your footsteps echo through the halls.');
    const level=sprinting?.065:.043;
    const textureFrequency=state.level===1?950:state.level===2?1800:230;
    tone(sprinting?80:67,ctx.currentTime,.13,level,'sine',35);
    filteredNoise(ctx.currentTime,.115,level*.70,textureFrequency,.55,Math.random()*.18-.09);
    filteredNoise(ctx.currentTime+.012,.07,level*.13,1450,.8);
  }
  function collect() {
    if(!available())return;
    captionHandler('A small chime rings out.');
    const at=ctx.currentTime;
    [660,880,1320].forEach((frequency,index)=>tone(frequency,at+index*.07,.45,.07-index*.012));
  }
  function sting() {
    if(!available())return;
    const at=ctx.currentTime;
    tone(56,at,.95,.17,'sine',33);
    tone(147,at,.65,.055,'triangle',173);
    tone(155,at+.02,.65,.05,'triangle',182);
    filteredNoise(at,.38,.10,650,.5);
  }
  function scarePrelude(type,variant,side=1){
    if(!available())return;const at=ctx.currentTime;
    tone(43,at,.48,.035,'sine',32);
    filteredNoise(at,.3,.025,type==='hound'?320:1500,2,side*.7);
    if(variant==='blackout')tone(110,at,.12,.035,'triangle',40);
    if(variant==='footsteps'){for(let i=0;i<3;i++){tone(65,at+i*.17,.14,.025+i*.006,'sine',35);filteredNoise(at+i*.17,.12,.024,280,.6,-side*(1-i*.35));}}
    if(variant==='ceiling-drop')filteredNoise(at,.27,.033,2200,2);
    if(variant==='behind-you'){filteredNoise(at,.25,.035,420,1.5,side*.95);filteredNoise(at+.28,.24,.03,550,1.5,side*.9);}
    if(variant==='doubletake')tone(180,at+.17,.19,.025,'triangle',80);
    if(variant==='door-slam')filteredNoise(at,.2,.025,700,2.5,side*.6);
    if(variant==='signal'){filteredNoise(at,.09,.03,3300,1);tone(210,at,.2,.018,'sine',180);}
  }
  function jumpscare(fatal=false,type='sahur',variant='ambush',side=1) {
    if(!available())return;const at=ctx.currentTime,level=variant==='glimpse'?.4:1;
    if(variant==='door-slam'){tone(62,at,.55,.12,'sine',28);tone(145,at,.3,.055,'triangle',75);filteredNoise(at,.18,.15,1700,.8,side*.5);return;}
    if(variant==='steam-burst'){filteredNoise(at,.65,.17,2300,.55,side*.7);filteredNoise(at+.12,.44,.09,780,.7,-side*.2);tone(100,at,.2,.04,'sine',50);return;}
    if(variant==='footsteps'){tone(69,at,.15,.035,'sine',32);filteredNoise(at,.1,.04,320,.9,side*.95);return;}
    if(variant==='signal'){filteredNoise(at,.11,.11,3200,1.5);tone(280,at,.28,.055,'sawtooth',90);filteredNoise(at+.15,.14,.055,1400,2);return;}
    if(variant==='shadow-cross'){filteredNoise(at,.25,.07,950,1,-side*.9);filteredNoise(at+.12,.22,.055,700,1,side*.9);tone(170,at,.3,.035,'sine',60);return;}
    tone(type==='hound'?63:48,at,.8,.17*level,'sine',25);
    if(type==='sahur'){for(let i=0;i<3;i++)tone(170,at+i*.075,.14,.1*level,'triangle',52);filteredNoise(at,.34,.14*level,1400,.6,side*.25);}
    if(type==='smiler'){tone(740,at,.55,.065*level,'sawtooth',160);tone(777,at+.015,.48,.055*level,'triangle',210);filteredNoise(at,.43,.14*level,2700,.7,side*.35);}
    if(type==='hound'){tone(110,at,.55,.08*level,'sawtooth',36);filteredNoise(at,.6,.17*level,420,1,side*.4);filteredNoise(at+.06,.3,.1*level,1500,.9);}
    if(type==='watcher'){tone(147,at,.6,.065*level,'triangle',75);tone(154,at+.025,.65,.055*level,'triangle',89);filteredNoise(at,.45,.15*level,880,2.1,side*.4);}
    if(type==='ballerina'){[1046,988,659].forEach((f,i)=>tone(f,at+i*.065,.28,.055*level,'triangle',f*.75));filteredNoise(at,.3,.07*level,2000,2);}
    if(type==='bribri'){tone(260,at,.4,.075*level,'sawtooth',70);filteredNoise(at,.3,.12*level,1300,1.3);}
    if(type==='spioniro'){filteredNoise(at,.08,.14*level,3500,.7);tone(720,at,.4,.06*level,'triangle',120);}
    if(type==='bombardino'){tone(83,at,.65,.085*level,'sawtooth',33);filteredNoise(at,.5,.12*level,420,.6);}
    if(fatal)filteredNoise(at+.2,.3,.07,220,.6);
  }
  function crank(){if(!available()||ctx.currentTime-lastCrank<.17)return;lastCrank=ctx.currentTime;tone(115,ctx.currentTime,.08,.023,'triangle',85);filteredNoise(ctx.currentTime,.095,.021,670,1.3);}
  function torchClick(){if(!available())return;filteredNoise(ctx.currentTime,.055,.022,2100,1.5);tone(220,ctx.currentTime,.06,.02,'triangle',120);}
  function stunPulse(){if(!available())return;const at=ctx.currentTime;tone(1800,at,.18,.09,'sawtooth',220);tone(105,at,.22,.1,'sine',45);filteredNoise(at,.15,.09,2600,1.2);}
  function win() {
    if(!available())return;
    const at=ctx.currentTime;
    [261.63,329.63,392,523.25].forEach((frequency,index)=>tone(frequency,at+index*.16,1.45,.085-index*.012));
  }
  function setVolume(value) {
    volume=Math.max(0,Math.min(1,Number(value)||0));
    if(ctx&&master)master.gain.setTargetAtTime(paused?0:volume,ctx.currentTime,.07);
  }
  function setCaptionHandler(handler) {
    captionHandler=typeof handler==='function'?handler:()=>{};
  }
  function pause() {
    paused=true;
    if(ctx&&master) {
      for(const source of live)try{source.stop();}catch{}
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0,ctx.currentTime,.025);
      // Suspending stops room tone and processing while tabbed away.
      ctx.suspend().catch(()=>{});
    }
  }
  async function resume() {
    paused=false;
    if(!ctx||disposed)return;
    try{await ctx.resume();}catch{}
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(volume,ctx.currentTime,.1);
  }
  function dispose() {
    disposed=true;initialized=false;
    for(const node of [...loops,...live]) {try{node.stop();node.disconnect();}catch{}}
    live.clear();loops.length=0;
    if(ctx&&ctx.state!=='closed')ctx.close().catch(()=>{});
  }
  return {init,update,step,collect,sting,scarePrelude,jumpscare,stunPulse,torchClick,crank,win,knock,entityCue,setVolume,setCaptionHandler,pause,resume,dispose};
}
