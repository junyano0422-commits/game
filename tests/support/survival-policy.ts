import {actSurvival,createSurvival,omen,puzzle} from '../../src/haunt/survival';
import type {SurvivalCommand,SurvivalRun} from '../../src/haunt/survival';
import type {HauntMode} from '../../src/haunt/config';
export function playSurvival(seed:number,policy:'rush'|'prepared'|'cautious'='prepared',mode:HauntMode='quick',tv:'on'|'off'='on'){
 let run=createSurvival(seed,mode);
 const act=(command:SurvivalCommand)=>{if(run.phase==='play')run=actSurvival(run,command) as SurvivalRun;};
 const heal=()=>{if(policy!=='rush'&&run.phase==='play'&&run.health<=1&&run.bag.includes('herb'))act({kind:'use',item:'herb'});};
 const move=(room:SurvivalRun['room'])=>{heal();if(policy!=='rush'&&omen(run).id==='steps')act({kind:'wait'});heal();act(policy==='cautious'&&run.battery>1?{kind:'move',room,pace:'quiet'}:{kind:'move',room});};
 const search=()=>{heal();act({kind:'search',light:omen(run).id==='eyes'&&!run.ward&&run.battery>0});};
 search();if(tv==='off')act({kind:'unplug'});
 if(policy!=='rush'){act({kind:'take',item:'battery'});act({kind:'use',item:'battery'});act({kind:'take',item:'herb'});}
 move('study');search();act({kind:'take',item:'key'});
 if(policy==='prepared'){act({kind:'take',item:'powder'});act({kind:'craft'});heal();act({kind:'use',item:'flare'});}
 move('well');search();move('bath');search();
 if(policy!=='rush'&&run.phase==='play'&&run.bag.length<4&&!run.bag.includes('herb'))act({kind:'take',item:'herb'});
 move('living');move('door');act({kind:'seal',symbols:puzzle(run).solution});
 return run;
}
