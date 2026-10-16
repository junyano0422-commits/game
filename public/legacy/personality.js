/* Game-only interpretation of recorded choices. */
const TOWER_PERSONALITY=(()=>{
 const limit=n=>Math.max(0,Math.min(100,n));
 const axes=[
 {id:'people',label:'対話・共感',icon:'🤝',high:'住民の納得や暮らしを優先',low:'説明よりも実行・効率を優先',strength:'意見の違う人にも目を配り、納得できる着地点を探せる。',blind:'全員の希望をかなえようとして、費用や決断の時期を後回しにしがち。',tip:'希望を聞いた後は、予算と期限を先に決めると判断が締まります。'},
 {id:'care',label:'将来への備え',icon:'🛡️',high:'点検・保全や将来の安心を優先',low:'目の前の暮らしや負担を優先',strength:'見えないリスクに気づき、先の安心のために手を打てる。',blind:'備えを厚くするあまり、今の住民負担や楽しさを小さくしがち。',tip:'保全計画に、小さな暮らしの改善も一つ組み込んでみましょう。'},
 {id:'finance',label:'資金の堅実さ',icon:'📋',high:'費用・固定費や資金余力を優先',low:'費用よりも品質・サービスを優先',strength:'目先の豪華さに流されず、続けられる運営を考えられる。',blind:'支出を抑えることが目的になり、必要な改善まで先送りしがち。',tip:'「削る費用」と「守る投資」を分けると、節約が価値に変わります。'},
 {id:'change',label:'変化への挑戦',icon:'✨',high:'新しい整備・仕組みへ投資',low:'既存設備の活用や現状維持を優先',strength:'今ある形を当たり前にせず、新しい価値をつくる決断ができる。',blind:'新しい計画に気持ちが向き、完成後の維持費や説明を見落としがち。',tip:'新しい案には、完成後の費用と住民への説明をセットにしましょう。'}];
 const names={people:'住民をつなぐ調整役',care:'未来を守る守護者',finance:'堅実に積む設計家',change:'価値をつくる改革家'};
 const pairs={'care+people':'寄り添う守護者','care+finance':'堅実な長期設計家','change+people':'暮らしを変える演出家','care+change':'未来をつくる改革家','finance+people':'納得をつくる調整役','change+finance':'投資を選ぶ戦略家'};
 function values(c={}){let e=c.effect||{},cost=c.cost||0;return{people:limit(50+(e.trust||0)*3+(e.happy||0)*2+((e.family||0)+(e.senior||0))*1.5),care:limit(50+(e.health||0)*4+(e.reserveFee||0)*.005+(e.repairDiscount||0)*150),finance:limit(50-cost*2-(e.op||0)*12+(e.income||0)*12+(e.fee||0)*.003+(e.reserveFee||0)*.002),change:limit(35+cost*3+(c.asset?25:0)+Math.max(0,e.brand||0)*2+Math.abs(e.op||0)*4)}}
 function record(s,title,c,source='議案',override){if(s._automatic)return;s.personalityChoices||=[];let v=override||values(c);s.personalityChoices.push({year:s.year,title,source,values:Object.fromEntries(axes.map(a=>[a.id,Math.round(limit(v[a.id]??50))]))})}
 function diagnose(s){let entries=s.personalityChoices||[],count=entries.length;let measured=axes.map(a=>({...a,value:count?Math.round(entries.reduce((n,c)=>n+c.values[a.id],0)/count):50})),ranked=[...measured].sort((a,b)=>b.value-a.value),first=ranked[0],second=ranked[1],spread=first.value-ranked.at(-1).value;let title=!count?'診断はこれから':spread<8?'バランスを探る理事長':first.value-second.value<7?pairs[[first.id,second.id].sort().join('+')]:names[first.id];let evidence=[...entries].sort((a,b)=>b.values[first.id]-a.values[first.id]).filter((e,i,a)=>a.findIndex(x=>x.title===e.title)===i).slice(0,3);return{title,count,provisional:count<5,axes:measured,icon:count?first.icon:'🧭',summary:!count?'この更新後の選択が記録されると、判断傾向が分かります。':spread<8?'一つの正解に偏らず、その場の事情を見比べる判断が多いようです。':first.high+'する選択が目立ちました。',strength:count?(spread<8?'暮らし・資金・将来を一緒に見て、状況に合わせて選び直せる。':first.strength):'',blind:count?(spread<8?'比較を続けて、何を最優先するかが周囲に伝わりにくいことも。':first.blind):'',tip:count?(spread<8?'次のプレイでは、最初に一つだけ「譲れない軸」を決めてみましょう。':first.tip):'新しいゲームで、あなたの選択を重ねてみましょう。',evidence}}
 return{axes,values,record,diagnose};
})();
if(typeof module!=='undefined')module.exports=TOWER_PERSONALITY;
