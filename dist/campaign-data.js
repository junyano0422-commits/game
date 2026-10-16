/* Fictional scenario parameters. These are not assertions about the actual properties. */
const TOWER_CAMPAIGN_DATA={
 profiles:{
  koiwa:{name:'ゼロからつくる住民の輪',tag:'新生活 × 将来への備え',description:'便利さを育てながら、これからの修繕に備える。',health:88,brand:58,trust:55,groups:{family:70,owner:65,senior:62},reserve:110,cash:11,fee:24000,service:'balanced',levels:{parcel:1},wear:.95,first:'voice',goal:'信頼される新しいコミュニティへ',goalStat:'trust',goalTarget:85,goalHappy:72},
  koishikawa:{name:'上質を守る理事会',tag:'品質 × 住民合意',description:'充実した初期設備を保ちながら、住民の期待と負担を調整する。',health:80,brand:72,trust:65,groups:{family:66,owner:74,senior:68},reserve:145,cash:13,fee:30000,service:'hotel',levels:{lobby:1,work:1},wear:1.05,first:'privacy',goal:'上質な住まいを次世代へ',goalStat:'brand',goalTarget:85,goalHappy:70},
  skyz:{name:'緑と家族のコミュニティ',tag:'交流 × 便利さ',description:'整備済みの庭を起点に、暮らしの便利さと防災を両立する。',health:78,brand:65,trust:60,groups:{family:75,owner:61,senior:67},reserve:145,cash:12,fee:26000,service:'balanced',levels:{garden:1,parcel:1},wear:1,first:'disaster',goal:'全世代が暮らしやすい住まいへ',goalStat:'happy',goalTarget:82,goalHappy:70},
  toyosu:{name:'設備更新のマネジメント',tag:'更新 × 収支',description:'既存設備を生かしつつ、更新投資を計画的に進める。',health:68,brand:63,trust:64,groups:{family:70,owner:67,senior:64},reserve:165,cash:15,fee:28000,service:'balanced',levels:{garden:1,eco:1},wear:1.08,first:'elevator',goal:'更新と暮らしを両立する',goalStat:'health',goalTarget:85,goalHappy:70},
  world:{name:'多彩な共用部の運営',tag:'施設 × 固定費',description:'共用部を育てながら、サービスの固定費をコントロールする。',health:72,brand:68,trust:58,groups:{family:68,owner:64,senior:70},reserve:155,cash:16,fee:28000,service:'balanced',levels:{work:1,lobby:1,garden:1},wear:1.1,first:'energy',goal:'共用部の魅力を持続させる',goalStat:'brand',goalTarget:85,goalHappy:70},
  kachidoki:{name:'巨大コミュニティの合意形成',tag:'スケール × 信頼',description:'多様な住民の意見を束ね、設備投資の優先順位を決める。',health:85,brand:72,trust:52,groups:{family:70,owner:74,senior:60},reserve:120,cash:14,fee:28000,service:'balanced',levels:{lobby:1,parcel:1},wear:1,first:'voice',goal:'大きな合意をつくる理事会へ',goalStat:'trust',goalTarget:85,goalHappy:70},
  tokyo:{name:'長期修繕の采配',tag:'保全 × 計画',description:'修繕資金を守り、見える魅力と見えない設備を更新する。',health:67,brand:61,trust:66,groups:{family:66,owner:65,senior:72},reserve:180,cash:17,fee:28000,service:'balanced',levels:{safe:1,garden:1},wear:1.12,first:'budget',goal:'安心できる建物を残す',goalStat:'health',goalTarget:88,goalHappy:70}
 },
 residents:[{id:'family',name:'佐藤さん',role:'子育て世帯の住民',avatar:'🧑‍🧑‍🧒',wish:'毎日の便利さと、子どもの居場所が大切。'},{id:'owner',name:'黒田さん',role:'資産と収支を重視する住民',avatar:'🧑‍💼',wish:'派手さだけでなく、将来の収支も見てほしい。'},{id:'senior',name:'田中さん',role:'長く暮らしたい住民',avatar:'🧓',wish:'設備の安心と、無理のない負担を大事にしたい。'}],
 issues:[
 {id:'initial',maxAge:2,resident:'senior',title:'入居後の点検で、小さな不具合を確認',quote:'使い始めて気づいた点を、まとめて相談したいです。',body:'扉の調整や設備の動作確認など、入居後の気づきを集める。老朽化の更新ではなく、施工・保守窓口との確認と調整。予防点検でも解決できる。',project:'',action:'inspect',fund:'cash',cost:.8,effect:{health:4,senior:6,trust:5},penalty:{senior:-4,trust:-3},fix:'点検記録をまとめ、施工・保守窓口と調整'},
 {id:'delivery',resident:'family',title:'荷物が受け取れない日が続く',quote:'仕事帰りに受け取れないと、結構つらいんです。',body:'宅配の混雑が毎日の不便に。宅配設備が年末までに完成すれば、根本解決につながる。',project:'parcel',fund:'cash',cost:2.2,action:'',effect:{family:10,trust:4},penalty:{family:-8,trust:-3},fix:'臨時スタッフと予約運用を整える'},
 {id:'elevator',minAge:15,asset:'lift',minEquipmentAge:15,resident:'senior',title:'朝のエレベーターに不安の声',quote:'階段では上り下りできないので、早めに見てほしい。',body:'混雑と設備への懸念が寄せられた。予防点検で応急対応、エレベーター更新の完成で解決できる。',project:'lift',action:'inspect',fund:'reserve',cost:8,effect:{health:9,senior:7,trust:3},penalty:{health:-7,senior:-5,trust:-2},fix:'部品交換と運行調整をまとめて実施'},
 {id:'pipes',minAge:20,asset:'pipe',minEquipmentAge:20,resident:'senior',title:'見えない配管、更新の相談',quote:'表から見えなくても、古くなる場所はありますよね。',body:'築年数と前回工事からの経過を踏まえ、共用配管の調査・更新を相談。点検で影響を抑え、必要な工事を判断する。',project:'',action:'inspect',fund:'reserve',cost:9,effect:{health:11,senior:5},penalty:{health:-8,brand:-3},fix:'調査に基づき共用配管の更新を行う'},
 {id:'energy',resident:'owner',title:'電気代、このままでいい？',quote:'毎年かかる費用こそ、投資して減らしませんか。',body:'固定費への不安が高まっている。省エネ設備が年末までに完成すれば、要望への回答になる。',project:'eco',action:'bids',fund:'cash',cost:2.8,effect:{owner:9,trust:4},penalty:{owner:-7,trust:-4},fix:'運用調査と契約見直しを集中的に実施'},
 {id:'voice',resident:'owner',title:'「誰のための投資？」が広がる',quote:'順番の理由が分かれば、賛成しやすいんです。',body:'複数の要望に優先順位が必要。住民説明会で、投資の順番と根拠を伝えよう。',project:'',action:'talk',fund:'cash',cost:1.8,effect:{trust:10,owner:7},penalty:{trust:-7,owner:-5},fix:'比較資料を作り個別対話を重ねる'},
 {id:'privacy',resident:'owner',title:'共用ラウンジの撮影、どうする？',quote:'紹介はうれしいけれど、暮らしのプライバシーも守って。',body:'共用部の撮影を巡り意見が分かれた。住民説明会でルールを共有すると解決につながる。',project:'',action:'talk',fund:'cash',cost:1.7,effect:{trust:8,brand:4,owner:5},penalty:{trust:-6,owner:-5},fix:'撮影ルールと案内を一体で整備'},
 {id:'disaster',resident:'senior',title:'停電したら、上の階はどうなる？',quote:'備蓄だけでなく、電源のことも知りたいです。',body:'災害時の生活継続への相談。防災センターの完成で、備えを形にできる。',project:'safe',action:'inspect',fund:'reserve',cost:7,effect:{health:8,senior:8,trust:3},penalty:{health:-5,senior:-7},fix:'非常設備と備蓄を重点更新'},
 {id:'garden',resident:'family',title:'外に、ひと息つける場所が欲しい',quote:'ベンチがあれば、子どもと少し休めるのに。',body:'屋外に世代が交わる場所を求める声。ガーデン整備の完成、または交流イベントが回答になる。',project:'garden',action:'festival',fund:'cash',cost:2.1,effect:{family:9,senior:5,trust:3},penalty:{family:-6,senior:-3},fix:'仮設の居場所と交流プログラムを設ける'},
 {id:'work',resident:'family',title:'自宅以外で、少し集中したい',quote:'会議が重なる日は、使える場所があると助かります。',body:'静かな作業場所への要望。ワークラウンジが完成すれば解決する。',project:'work',action:'',fund:'cash',cost:2.5,effect:{family:10,brand:3},penalty:{family:-7,brand:-2},fix:'共用室に臨時の作業席を確保'},
 {id:'budget',resident:'owner',title:'工事の前に、見積もりを比べたい',quote:'安さだけでなく、何が違うのか知りたい。',body:'長期の工事計画への相談。固定費の比較調査も、納得の材料になる。',project:'',action:'bids',fund:'cash',cost:2,effect:{trust:7,owner:8},penalty:{trust:-5,owner:-6},fix:'専門家を交えて仕様を比較'},
 {id:'community',minAge:5,resident:'senior',title:'顔を知る人が、少なくなった',quote:'長く住むなら、挨拶できる相手がいると安心。',body:'暮らしのつながりへの相談。交流イベントを開催すると解決できる。',project:'',action:'festival',fund:'cash',cost:1.6,effect:{senior:10,family:4,trust:4},penalty:{senior:-7,trust:-3},fix:'世代を超えた小さな集まりを継続する'}
 ],
 chapterEvents:[
 {from:1,to:10,title:'どんなタワマンに育てたい？',cat:'第1章 / 最初の方針',body:'目立つ共用部と日常の使いやすさ。限られた予算で、最初の印象を決める。',choices:[{label:'景観の仕上げを上質に',cost:8,fund:'reserve',effect:{brand:9,owner:6,senior:-4},text:'印象は向上。予算の使い方への意見も分かれた。'},{label:'毎日の使いやすさを優先',cost:2,effect:{family:8,senior:6,brand:2},text:'日常の小さな不便を減らす運営が始まった。'},{label:'将来の修繕に備えて支出を抑える',cost:0,effect:{owner:3,brand:-3},text:'支出を抑えた。暮らしの改善は次の機会へ。'}]},
 {from:1,to:10,title:'にぎやかな共用部、静かな共用部。',cat:'第1章 / 暮らしの違い',body:'交流を求める人、静かに過ごしたい人。どちらにも理由がある。',choices:[{label:'交流する時間を増やす',cost:0,effect:{family:9,senior:-5,trust:2},text:'子育て世帯は好評。静けさを望む声にも配慮が必要。'},{label:'静かに過ごせる時間を増やす',cost:.5,effect:{senior:8,family:-5,owner:2},text:'落ち着いた雰囲気に。交流の機会を求める人もいる。'},{label:'用途別に時間を細かく分ける',cost:2,effect:{family:4,senior:4,op:.35},text:'共存のルールを整えたが、毎年の運営の手間は増える。'}]},
 {from:11,to:20,minAge:10,title:'更新工事の騒音、何を優先する？',cat:'第2章 / 工事と暮らし',body:'更新の必要性は伝わっている。それでも工事の不便は、毎日の生活に響く。',choices:[{label:'工事を集約して早く終える',cost:3,fund:'reserve',effect:{health:9,happy:-7},text:'設備の更新を前進させた。工事期間中の不満は増加。'},{label:'住民との調整に人手をかける',cost:2.5,effect:{trust:7,happy:2,health:3},text:'費用を使って暮らしとの調整を進めた。'},{label:'作業を小分けにする',cost:0,effect:{health:2,op:1.1,happy:2},text:'今の不便は軽減。長期化する運営コストが残った。'}]},
 {from:11,to:20,title:'空きスペースを、収入か居場所に。',cat:'第2章 / 使い方の更新',body:'使い道を見直せるスペースができた。収支の改善と住み心地、どちらを重く見る？',choices:[{label:'有料の利用枠を増やす',cost:1,effect:{income:1.1,owner:6,family:-6,senior:-3},text:'毎年の収入が増加。自由に使いたい住民には不評。'},{label:'住民の居場所へ改装',cost:7,fund:'reserve',effect:{family:8,senior:7,brand:5,op:.35},text:'暮らしの居場所を育てた。整備と維持には費用がかかる。'},{label:'今年は現状を維持する',cost:0,effect:{owner:-3,brand:-2},text:'追加支出はなし。使い道を再検討する機会は見送った。'}]},
 {from:21,to:30,title:'30年後も、住み続けられる？',cat:'第3章 / 次の暮らし',body:'年齢や暮らし方が変わっても、住まいは続いていく。次の世代に何を残す？',choices:[{label:'バリアフリーの改修を進める',cost:9,fund:'reserve',effect:{health:8,senior:12,brand:5,owner:-3},text:'安心して長く暮らせる環境に投資した。'},{label:'新しい家族が入りやすい運用へ',cost:2.2,effect:{family:10,brand:6,senior:-4},text:'新たな暮らしを迎える準備。長年の住民の不安にも向き合いたい。'},{label:'今の使い方を守る',cost:0,effect:{senior:3,brand:-5,family:-3},text:'慣れた環境は守れたが、時代への対応は進まなかった。'}]},
 {from:21,to:30,title:'最後の大規模修繕、その先まで。',cat:'第3章 / 資産の継承',body:'今回を乗り切るだけでよいか。将来の費用と価値まで考えるか。',choices:[{label:'高耐久の仕様を追加',cost:6,fund:'reserve',effect:{health:12,brand:7,repairDiscount:-.06},text:'品質を高めた。その分、以後の工事仕様も高価になる。'},{label:'第三者と仕様を絞り込む',cost:2.8,effect:{repairDiscount:.06,trust:5,owner:5},text:'必要性を確かめ、以後の工事費を6%抑える方針へ。'},{label:'今年の支出を避ける',cost:0,effect:{brand:-3,health:-3},text:'追加支出を見送った。将来への上積みは残らなかった。'}]}
 ],
 chapters:[{from:1,to:10,title:'第1章 / 暮らしを育てる',description:'便利さと住民の信頼をつくる10年。次の修繕資金も忘れずに。',badge:'FOUNDATION'},{from:11,to:20,title:'第2章 / 更新の決断',description:'設備更新と大規模修繕が重なる時期。全部を同時には選べない。',badge:'RENEWAL'},{from:21,to:30,title:'第3章 / 次の世代へ',description:'建物・負担・魅力を再設計し、30年後に残す価値を決める。',badge:'LEGACY'}]
};
if(typeof module!=='undefined')module.exports=TOWER_CAMPAIGN_DATA;
Object.assign(TOWER_CAMPAIGN_DATA,{
 directions:{
  10:[{id:'care',name:'予防保全を軸にする',icon:'🛡️',description:'次の10年は故障を減らす。劣化速度15%減、設備工事費5%増。',mod:{wear:.85,project:1.05},effect:{health:5,senior:4}}, {id:'community',name:'住民参加で運営する',icon:'🤝',description:'毎年、信頼+1・満足+0.5。参加運営の年間費用+0.6万円/戸。',mod:{trust:1,happy:.5,op:.6},effect:{family:4,senior:3}}, {id:'smart',name:'固定費と効率を磨く',icon:'💡',description:'毎年の管理費用−1.2万円/戸。維持作業を絞り、劣化速度8%増。',mod:{op:-1.2,wear:1.08},effect:{owner:5,senior:-3}}],
  20:[{id:'resilient',name:'次世代へ、建物を残す',icon:'🏗️',description:'以後の大規模修繕費10%減。年間点検費用+0.8万円/戸。',mod:{repair:.9,op:.8},effect:{health:5,senior:5}}, {id:'premium',name:'住みたい魅力を育てる',icon:'✨',description:'毎年、魅力+1・満足+0.8。年間サービス費用+1.2万円/戸。',mod:{brand:1,happy:.8,op:1.2},effect:{family:5,owner:5}}, {id:'together',name:'住民が支える運営へ',icon:'🌱',description:'以後の優先課題の対応費20%減、毎年信頼+1。魅力の上積みは控えめ。',mod:{priority:.8,trust:1,brand:-.25},effect:{trust:5,senior:3}}]
 },
 traits:{
  koiwa:{title:'新しい住民の輪',description:'宅配・ガーデン工事費15%減、交流イベント効果20%増',projects:['parcel','garden'],discount:.85,actions:['festival'],actionBoost:1.2,difficulty:'★★☆'},
  koishikawa:{title:'上質な空間を磨く',description:'エントランス・ラウンジ工事費20%減',projects:['lobby','work'],discount:.8,difficulty:'★★☆'},
  skyz:{title:'緑と防災の計画',description:'ガーデン・防災センター工事費20%減',projects:['garden','safe'],discount:.8,difficulty:'★★☆'},
  toyosu:{title:'設備更新の段取り',description:'省エネ・エレベーター工事費20%減',projects:['eco','lift'],discount:.8,difficulty:'★★★'},
  world:{title:'多彩な共用部の活用',description:'ラウンジ・宅配・EV工事費15%減',projects:['work','parcel','ev'],discount:.85,difficulty:'★★★'},
  kachidoki:{title:'合意を育てる',description:'住民説明会の効果30%増',projects:[],discount:1,actions:['talk'],actionBoost:1.3,difficulty:'★★★'},
  tokyo:{title:'長期修繕の知恵',description:'大規模修繕費8%減、防災工事費15%減',projects:['safe'],discount:.85,repair:.92,difficulty:'★★★'}
 },
 arcs:{
  koiwa:{title:'この街で、家族が育つ',resident:'family',project:'garden',episodes:[['新しいご近所さん','まだ顔を知らない人ばかり。挨拶できる場所が欲しい。'],['子どもたちの居場所が変わる','以前遊んでいた子も、いまは学び、働き始めています。'],['独立しても、帰ってくる場所','次の家族にも、ここで暮らした思い出を渡したい。']],ending:'新しい住民の輪が、帰って来たくなる街になった。'},
  koishikawa:{title:'上質な暮らしの、その先',resident:'owner',project:'lobby',episodes:[['ここに住む誇りとは','きれいなだけでなく、暮らしに意味のある上質さを。'],['サービスと負担の分岐点','10年前の理想を、今の費用で続けられますか。'],['次の住民に残すもの','建物の名前だけでなく、管理の姿勢も伝えたい。']],ending:'上質さは、見栄えから暮らしの文化になった。'},
  skyz:{title:'庭で育つ、世代のつながり',resident:'family',project:'garden',episodes:[['子どもが遊ぶ、緑の場所','小さな庭の時間が、家族の思い出になっています。'],['庭の使い方も、家族も変わる','遊ぶ場所から、勉強や会話の場所にも育てたい。'],['次の家族を迎える庭へ','子どもが独立しても、帰って来たくなる庭に。']],ending:'庭を歩く世代は変わり、住まいへの愛着は受け継がれた。'},
  toyosu:{title:'使い続けるための更新',resident:'senior',project:'lift',episodes:[['設備の更新を、暮らしのために','見えない部分から、少しずつ整えてほしい。'],['工事の先にある、毎日','工事の不便もあります。でも、安心して使いたい。'],['長く住める選択を残す','住み慣れた場所で、次の10年も暮らしたい。']],ending:'更新の積み重ねが、長く暮らせる住まいをつくった。'},
  world:{title:'共用部は、誰の居場所？',resident:'owner',project:'work',episodes:[['たくさんの施設、ひとつの予算','施設を使う人も使わない人も納得できる運営に。'],['維持するもの、変えるもの','全部を残すより、今の住民に必要な使い方を。'],['この場所の魅力を次へ','数字だけで測れない良さも、残したいですね。']],ending:'多彩な共用部が、住民に使われ続ける居場所になった。'},
  kachidoki:{title:'大きな街に、ひとつの合意',resident:'owner',project:'lobby',episodes:[['大きな理事会、届かない声','数が多いからこそ、理由を聞いてほしい。'],['対立の先で、折り合う','以前の説明を覚えています。今回も話し合いたい。'],['次の理事会へ渡す約束','人が替わっても、納得できる手続きは残せます。']],ending:'大きなコミュニティに、話し合う文化が根付いた。'},
  tokyo:{title:'30年先の安心を、いま選ぶ',resident:'senior',project:'safe',episodes:[['修繕は、未来の暮らし','費用は気になります。でも、安心も後回しにしたくない。'],['目に見える変化、見えない備え','きれいになった場所の裏で、設備も守ってほしい。'],['次の世代にも安心を','ここで暮らせてよかった、と言える建物を残したい。']],ending:'修繕の判断が、世代を超える安心として残った。'}
 },
 lives:{
  family:[{age:36,title:'子どもと新しい暮らし',quote:'家族が使いやすい場所を、一緒に育てたい。'},{age:46,title:'子どもの成長と働き方',quote:'静かに学べる場所や、働ける共用部があると助かる。'},{age:56,title:'独立する子ども、帰れる場所',quote:'家族の形が変わっても、帰りたくなる住まいに。'}],
  owner:[{age:42,title:'住まいと資産を育てる',quote:'無理なく価値を育てる計画を聞きたい。'},{age:52,title:'働き方と家計を見直す',quote:'将来の負担まで含めて、投資を考えたい。'},{age:62,title:'次の世代へ資産を渡す',quote:'維持できる仕組みと、納得できる記録を残したい。'}],
  senior:[{age:62,title:'安心して暮らし始める',quote:'これからも暮らせる備えが気になります。'},{age:72,title:'移動と設備の安心',quote:'設備の使いやすさが、日々の暮らしに響くようになった。'},{age:82,title:'住み慣れた場所を大事に',quote:'顔を知る人がいて、安心して暮らし続けたい。'}]
 }
});
