/*
 * Curated, ORIGINAL topic-practice fixtures for UP Police Constable testing.
 * Not official previous-year papers. Deterministic for repeatable QA.
 * Usage (Node): const { build } = require('./tools/seed-topic-practice');
 */
'use strict';
const SUBJECTS = [
  {id:'hindi',name:'General Hindi'},
  {id:'gk',name:'General Knowledge'},
  {id:'numerical',name:'Numerical and Mental Ability'},
  {id:'reasoning',name:'Mental Aptitude, I.Q. and Reasoning Ability'}
];
const levels = ['Foundation','Medium','Advanced'];
const entries = [];
function add(subject,slug,topic,questions) {
  if(questions.length!==15) throw Error(topic+' needs 15 questions; got '+questions.length);
  entries.push({subject,slug,topic,questions});
}
function manual(subject,slug,topic,rows) {
  add(subject,slug,topic,rows.map(([question,answer,distractors,explanation])=>({
    question,answer,distractors,explanation
  })));
}
function numeric(question,answer,explanation,step=1){
  const a=Number(answer);if(!Number.isFinite(a)) throw Error(question);
  const deltas=[step,step*2,-step,-step*2,step*3,-step*3,step*4];
  const distractors=deltas.map(d=>a+d).filter(x=>x>=0&&x!==a).map(String);
  return {question,answer:String(a),distractors,explanation};
}
function wordOptions(correct,options){
  const answer=String(correct);
  return [answer,...options.filter(v=>String(v)!==answer).map(String)];
}
function arrange(row,index){
  const correct=String(row.answer);
  const unique=[...new Set((row.distractors||[]).map(String).filter(x=>x!==correct&&x.trim()))].slice(0,3);
  if(unique.length!==3) throw Error('3 unique distractors required: '+row.question);
  const position=index%4;
  const options=[...unique];options.splice(position,0,correct);
  if(options.length!==4||new Set(options).size!==4)throw Error('Invalid options: '+row.question);
  return {options,correctOption:position};
}
// Hindi: manually checked vocabulary and spelling.
const syn=[
 ['अग्नि','अनल'],['आकाश','गगन'],['कमल','पंकज'],['सूर्य','दिनकर'],['जल','नीर'],
 ['पृथ्वी','वसुंधरा'],['चंद्रमा','शशि'],['वन','अरण्य'],['पवन','समीर'],['नदी','सरिता'],
 ['पर्वत','गिरि'],['राजा','नरेश'],['रात्रि','निशा'],['आँख','नयन'],['समुद्र','सागर']
];
manual('hindi','synonyms','पर्यायवाची शब्द',syn.map(([a,b],i)=>[
 "'"+a+"' का पर्यायवाची शब्द चुनिए।",b,
 [syn[(i+4)%15][1],syn[(i+7)%15][1],syn[(i+10)%15][1]],
 "'"+b+"' शब्द '"+a+"' का समानार्थी है।"
]));
const ant=[
 ['दिन','रात'],['लाभ','हानि'],['सत्य','असत्य'],['जीत','हार'],['आगमन','प्रस्थान'],
 ['उदय','अस्त'],['उन्नति','अवनति'],['सुख','दुःख'],['प्राचीन','नवीन'],['मित्र','शत्रु'],
 ['स्वतंत्र','परतंत्र'],['उदार','कृपण'],['स्थूल','सूक्ष्म'],['अल्प','अधिक'],['आरंभ','अंत']
];
manual('hindi','antonyms','विलोम शब्द',ant.map(([a,b],i)=>[
 "'"+a+"' का विलोम शब्द कौन-सा है?",b,
 [ant[(i+3)%15][1],ant[(i+6)%15][1],ant[(i+9)%15][1]],
 "'"+b+"' का अर्थ '"+a+"' के विपरीत है।"
]));
const spelling=[
 ['आशीर्वाद',['आशिर्वाद','आशीरवाद','आशीर्वद']],
 ['विद्यालय',['विध्यालय','विद्याल्य','विधयालय']],
 ['आवश्यकता',['आवशकता','आवश्यक्ता','आवशयकता']],
 ['व्यवस्था',['व्यवसथा','व्यवश्था','व्यवस्ठा']],
 ['स्वास्थ्य',['स्वास्थय','स्वासथ्य','स्वास्थ']],
 ['स्वतंत्रता',['सवतंत्रता','स्वतन्तरता','सवतन्त्रता']],
 ['प्रतियोगिता',['प्रतियोगीता','प्रतीयोगिता','प्रतियागिता']],
 ['अभ्यास',['अभयास','अभियास','अभ्यास्स']],
 ['वैज्ञानिक',['वेज्ञानिक','वैग्यानिक','वैज्ञानीक']],
 ['प्रोत्साहन',['प्रोतसाहन','प्रोत्साहान','प्रोत्तसाहन']],
 ['उपलब्धि',['उपल्बधि','उपलव्धि','उपलबधी']],
 ['प्रतिष्ठा',['प्रतिश्ठा','प्रतीष्ठा','प्रतिष्ठां']],
 ['परिस्थिति',['परिसथिति','परीस्थिति','परिस्तिथि']],
 ['दायित्व',['दाइत्व','दायीत्व','दायीत्त्व']],
 ['अनुशासन',['अनूशासन','अनुशाशन','अनुसासन']]
];
manual('hindi','spelling','शुद्ध वर्तनी',spelling.map(([answer,wrongs])=>[
 'निम्न में से शुद्ध वर्तनी वाला शब्द चुनिए।',answer,wrongs,
 "'"+answer+"' की वर्तनी सही है; अन्य विकल्पों में अक्षर अथवा मात्रा की त्रुटि है।"
]));
// Static general-knowledge facts. No changing current-affairs claims.
const constitution=[
 ['भारतीय संविधान कब लागू हुआ?','26 जनवरी 1950',['15 अगस्त 1947','26 नवंबर 1949','2 अक्टूबर 1950']],
 ['संविधान सभा के स्थायी अध्यक्ष कौन थे?','डॉ. राजेंद्र प्रसाद',['डॉ. बी. आर. आंबेडकर','जवाहरलाल नेहरू','सरदार पटेल']],
 ['संविधान की प्रारूप समिति के अध्यक्ष कौन थे?','डॉ. बी. आर. आंबेडकर',['डॉ. राजेंद्र प्रसाद','के. एम. मुंशी','मौलाना आजाद']],
 ['भारतीय संविधान में मौलिक अधिकार किस भाग में हैं?','भाग III',['भाग I','भाग II','भाग IV']],
 ['राज्य के नीति निर्देशक तत्व किस भाग में हैं?','भाग IV',['भाग II','भाग III','भाग V']],
 ['भारतीय संविधान में मौलिक कर्तव्यों का उल्लेख किस अनुच्छेद में है?','अनुच्छेद 51A',['अनुच्छेद 21','अनुच्छेद 32','अनुच्छेद 368']],
 ['भारतीय संसद के दो सदन कौन-से हैं?','लोकसभा और राज्यसभा',['विधानसभा और परिषद','लोकसभा और विधानसभा','राज्यसभा और ग्रामसभा']],
 ['भारत के राष्ट्रपति का सामान्य कार्यकाल कितना है?','5 वर्ष',['3 वर्ष','4 वर्ष','6 वर्ष']],
 ['राष्ट्रीय आपातकाल से संबंधित अनुच्छेद कौन-सा है?','अनुच्छेद 352',['अनुच्छेद 280','अनुच्छेद 324','अनुच्छेद 368']],
 ['संविधान का अनुच्छेद 21 मुख्यतः किस अधिकार का संरक्षण करता है?','जीवन और व्यक्तिगत स्वतंत्रता',['संपत्ति की विरासत','संसद में मतदान','राज्यपाल की नियुक्ति']],
 ['भारत के निर्वाचन आयोग से संबंधित अनुच्छेद कौन-सा है?','अनुच्छेद 324',['अनुच्छेद 280','अनुच्छेद 352','अनुच्छेद 51A']],
 ['संविधान संशोधन की प्रक्रिया किस अनुच्छेद में है?','अनुच्छेद 368',['अनुच्छेद 14','अनुच्छेद 19','अनुच्छेद 32']],
 ['भारत में GST से जुड़ा प्रमुख संवैधानिक संशोधन कौन-सा है?','101वाँ संशोधन',['42वाँ संशोधन','61वाँ संशोधन','73वाँ संशोधन']],
 ['वित्त आयोग की व्यवस्था किस अनुच्छेद में है?','अनुच्छेद 280',['अनुच्छेद 324','अनुच्छेद 352','अनुच्छेद 368']],
 ['मतदान की न्यूनतम आयु 21 से 18 वर्ष करने वाला संशोधन कौन-सा था?','61वाँ संशोधन',['42वाँ संशोधन','44वाँ संशोधन','86वाँ संशोधन']]
];
manual('gk','constitution','भारतीय संविधान',constitution.map(([q,a,d])=>[q,a,d,'सही उत्तर: '+a+'। यह भारतीय संविधान से संबंधित स्थापित तथ्य है।']));
const history=[
 ['1857 का व्यापक विद्रोह किस वर्ष आरंभ हुआ?','1857',['1757','1885','1905']],
 ['महात्मा गांधी ने दांडी यात्रा किस वर्ष शुरू की?','1930',['1919','1920','1942']],
 ['भारत छोड़ो आंदोलन किस वर्ष शुरू हुआ?','1942',['1930','1935','1947']],
 ['जलियाँवाला बाग हत्याकांड किस वर्ष हुआ?','1919',['1905','1928','1942']],
 ['असहयोग आंदोलन किस वर्ष प्रारंभ हुआ?','1920',['1905','1911','1935']],
 ['साइमन कमीशन भारत कब आया?','1928',['1919','1930','1946']],
 ['भारतीय राष्ट्रीय कांग्रेस की स्थापना कब हुई?','1885',['1857','1905','1919']],
 ['भारतीय राष्ट्रीय कांग्रेस के प्रथम अध्यक्ष कौन थे?','डब्ल्यू. सी. बनर्जी',['दादाभाई नौरोजी','बाल गंगाधर तिलक','महात्मा गांधी']],
 ['भारतीय राष्ट्रीय कांग्रेस का पहला अधिवेशन किस शहर में हुआ?','बंबई (मुंबई)',['कलकत्ता (कोलकाता)','लाहौर','इलाहाबाद (प्रयागराज)']],
 ['चंपारण सत्याग्रह किस वर्ष हुआ?','1917',['1905','1922','1930']],
 ['महात्मा गांधी दक्षिण अफ्रीका से भारत किस वर्ष लौटे?','1915',['1905','1919','1925']],
 ['बंगाल विभाजन और स्वदेशी आंदोलन का प्रमुख वर्ष कौन-सा है?','1905',['1885','1917','1930']],
 ['पूना समझौता किस वर्ष हुआ?','1932',['1916','1920','1942']],
 ['लखनऊ समझौता (कांग्रेस और मुस्लिम लीग) किस वर्ष हुआ?','1916',['1905','1928','1946']],
 ['आज़ाद हिंद फ़ौज का नेतृत्व 1943 में किसने संभाला?','सुभाष चंद्र बोस',['भगत सिंह','राजगुरु','लाला लाजपत राय']]
];
manual('gk','modern-history','आधुनिक भारतीय इतिहास',history.map(([q,a,d])=>[q,a,d,'सही उत्तर: '+a+'। यह भारतीय स्वतंत्रता आंदोलन के इतिहास का महत्वपूर्ण तथ्य है।']));
const geography=[
 ['क्षेत्रफल की दृष्टि से भारत का सबसे बड़ा राज्य कौन-सा है?','राजस्थान',['उत्तर प्रदेश','मध्य प्रदेश','महाराष्ट्र']],
 ['उत्तर प्रदेश की राजधानी क्या है?','लखनऊ',['कानपुर','प्रयागराज','वाराणसी']],
 ['वाराणसी नगर किस प्रमुख नदी के किनारे है?','गंगा',['यमुना','गोमती','घाघरा']],
 ['भारत का मानक देशांतर कौन-सा है?','82°30′ पूर्व',['68°30′ पूर्व','75°30′ पूर्व','90°30′ पूर्व']],
 ['कर्क रेखा लगभग किस अक्षांश पर स्थित है?','23½° उत्तर',['0°','66½° उत्तर','23½° दक्षिण']],
 ['भारत के पश्चिम में कौन-सा सागर है?','अरब सागर',['लाल सागर','बंगाल की खाड़ी','दक्षिण चीन सागर']],
 ['भारत के पूर्व में कौन-सी खाड़ी है?','बंगाल की खाड़ी',['अरब सागर','फ़ारस की खाड़ी','अदन की खाड़ी']],
 ['सुंदरबन किस नदी तंत्र के डेल्टा क्षेत्र से संबंधित हैं?','गंगा-ब्रह्मपुत्र',['नर्मदा-ताप्ती','कावेरी','गोदावरी-कृष्णा']],
 ['काली मिट्टी किस फसल के लिए विशेष रूप से उपयुक्त मानी जाती है?','कपास',['चाय','जूट','रबर']],
 ['पश्चिमी घाट को किस अन्य नाम से जाना जाता है?','सह्याद्रि',['अरावली','शिवालिक','विंध्य']],
 ['चिलिका झील किस राज्य में स्थित है?','ओडिशा',['बिहार','राजस्थान','असम']],
 ['लोकटक झील किस राज्य में है?','मणिपुर',['केरल','ओडिशा','गुजरात']],
 ['थार मरुस्थल का प्रमुख भाग किस भारतीय राज्य में है?','राजस्थान',['तमिलनाडु','बिहार','पश्चिम बंगाल']],
 ['नर्मदा नदी मुख्यतः किस दिशा में बहकर समुद्र में मिलती है?','पश्चिम',['पूर्व','उत्तर','दक्षिण']],
 ['मानसून में भारत को अधिकांश वर्षा किस मौसमी पवन से मिलती है?','दक्षिण-पश्चिम मानसून',['उत्तर-पूर्व शीत पवन','स्थायी पछुआ पवन','ध्रुवीय पूर्वी पवन']]
];
manual('gk','geography','भारत का भूगोल',geography.map(([q,a,d])=>[q,a,d,'सही उत्तर: '+a+'। यह भारतीय भूगोल का स्थापित तथ्य है।']));
// Numerical and Mental Ability: independently calculated integer examples.
const percentages=[];
[[120,10],[250,20],[60,50],[90,30],[400,15]].forEach(([n,p])=>{
  const a=n*p/100;percentages.push(n+' का '+p+'% कितना होगा?');
});
const P=[];
[[120,10],[250,20],[60,50],[90,30],[400,15]].forEach(([n,p])=>{
  P.push(numeric(n+' का '+p+'% कितना होगा?',n*p/100, p+'% = '+p+'/100; इसलिए '+n+' × '+p+'/100 = '+n*p/100+'।'));
});
[[200,15],[160,25],[500,12],[80,35],[240,10]].forEach(([n,p])=>{
  const a=n*(100+p)/100;P.push(numeric(n+' में '+p+'% की वृद्धि करने पर नया मान क्या होगा?',a,
    'वृद्धि = '+n+' × '+p+'/100 = '+n*p/100+'; नया मान = '+n+' + '+n*p/100+' = '+a+'।'));
});
[[30,72],[25,85],[40,144],[15,90],[12,48]].forEach(([p,v])=>{
  const a=v*100/p;P.push(numeric('किसी संख्या का '+p+'% = '+v+' है। मूल संख्या क्या है?',a,
    'यदि x का '+p+'% = '+v+' है, तो x = '+v+' × 100/'+p+' = '+a+'।'));
});
add('numerical','percentage','प्रतिशत',P);
const R=[];
[[2,3,50],[3,4,84],[4,5,81],[5,7,96],[7,8,120]].forEach(([a,b,sum])=>{
  const answer=sum*a/(a+b);R.push(numeric('दो राशियों का अनुपात '+a+':'+b+' है और उनका योग '+sum+' है। पहली राशि क्या है?',answer,
    'कुल भाग = '+(a+b)+'; पहली राशि = '+sum+' × '+a+'/'+(a+b)+' = '+answer+'।'));
});
[[2,5,45],[3,7,63],[4,9,81],[5,8,72],[7,11,99]].forEach(([a,b,y])=>{
  const answer=y*a/b;R.push(numeric('A:B = '+a+':'+b+' और B = '+y+' है। A का मान ज्ञात करें।',answer,
    'A = B × '+a+'/'+b+' = '+y+' × '+a+'/'+b+' = '+answer+'।'));
});
[[2,3,4,5,100],[3,4,5,6,90],[4,5,3,7,105],[5,6,7,8,96],[2,7,3,5,70]].forEach(([a,b,c,d,totalC])=>{
  // A:B = a:b; B:C=c:d; C is known.
  // A = totalC*(c/d)*(a/b).
  const answer=totalC*c*a/(d*b);
  if(!Number.isInteger(answer))throw Error('Non-integer ratio case '+answer);
  R.push(numeric('A:B = '+a+':'+b+' और B:C = '+c+':'+d+' हैं। यदि C = '+totalC+' है, तो A क्या है?',answer,
    'पहले B = C × '+c+'/'+d+'; फिर A = B × '+a+'/'+b+' = '+answer+'।'));
});
add('numerical','ratio','अनुपात व समानुपात',R);
const I=[];
[[1000,5,2],[2000,6,3],[1500,4,4],[2500,8,2],[3000,7,3]].forEach(([p,r,t])=>{
  const amount=p*r*t/100;I.push(numeric(p+' रुपये पर '+r+'% वार्षिक दर से '+t+' वर्षों का साधारण ब्याज कितना होगा?',amount,
    'साधारण ब्याज = मूलधन × दर × समय /100 = '+p+' × '+r+' × '+t+'/100 = '+amount+' रुपये।'));
});
[[120,6,2],[300,5,3],[360,9,2],[480,8,3],[600,10,2]].forEach(([interest,r,t])=>{
  const p=interest*100/(r*t);I.push(numeric(r+'% वार्षिक साधारण ब्याज पर '+t+' वर्ष में ब्याज '+interest+' रुपये है। मूलधन क्या है?',p,
    'मूलधन = ब्याज × 100/(दर × समय) = '+interest+' × 100/('+r+' × '+t+') = '+p+'।'));
});
[[1500,6,3],[2400,5,4],[3000,8,2],[4000,7,3],[5000,6,5]].forEach(([p,r,t])=>{
  const interest=p*r*t/100,amount=p+interest;
  I.push(numeric(p+' रुपये पर '+r+'% वार्षिक साधारण ब्याज से '+t+' वर्ष बाद कुल राशि कितनी होगी?',amount,
    'ब्याज = '+p+' × '+r+' × '+t+'/100 = '+interest+'; कुल राशि = '+p+' + '+interest+' = '+amount+'।'));
});
add('numerical','simple-interest','साधारण ब्याज',I);
// Mental aptitude and reasoning: explicit mathematical rules and known paths.
const S=[];
[[2,3],[5,4],[10,5],[7,7],[11,9]].forEach(([start,step])=>{
  const terms=Array.from({length:5},(_,i)=>start+i*step);S.push(numeric('अगली संख्या चुनिए: '+terms.join(', ')+', ?',start+5*step,
    'हर पद में '+step+' जोड़ा जाता है। '+terms[4]+' + '+step+' = '+(start+5*step)+'।'));
});
[[0,1],[2,1],[1,2],[3,2],[4,3]].forEach(([offset,mult])=>{
  const terms=Array.from({length:5},(_,i)=>mult*(i+1)*(i+1)+offset);
  const answer=mult*36+offset;
  S.push(numeric('श्रृंखला का अगला पद बताइए: '+terms.join(', ')+', ?',answer,
    'हर पद का नियम '+mult+' × n² + '+offset+' है। n=6 पर '+mult+' × 36 + '+offset+' = '+answer+'।'));
});
[[1,2,1],[2,3,2],[3,4,3],[5,2,4],[7,3,5]].forEach(([start,first,increment])=>{
  const terms=[start];let difference=first;
  for(let j=0;j<4;j++){terms.push(terms.at(-1)+difference);difference+=increment;}
  const answer=terms.at(-1)+difference;
  S.push(numeric('इस संख्या श्रृंखला में अगला पद क्या है? '+terms.join(', ')+', ?',answer,
    'अंतर क्रमशः '+Array.from({length:5},(_,i)=>first+i*increment).join(', ')+' हैं। अगला अंतर '+difference+', इसलिए उत्तर '+answer+'।'));
});
add('reasoning','number-series','संख्या श्रृंखला',S);
const DIR=[];
function stepsQuestion(moves,ask,level){
  let x=0,y=0;
  for(const [dir,n] of moves){if(dir==='पूर्व')x+=n; if(dir==='पश्चिम')x-=n;if(dir==='उत्तर')y+=n;if(dir==='दक्षिण')y-=n;}
  const route=moves.map(([d,n])=>d+' दिशा में '+n+' किमी').join(', फिर ');
  const d=(x===0&&y===0)?'प्रारंभिक बिंदु':x===0?(y>0?'उत्तर':'दक्षिण'):y===0?(x>0?'पूर्व':'पश्चिम'):(y>0?'उत्तर':'दक्षिण')+'-'+(x>0?'पूर्व':'पश्चिम');
  if(ask==='direction'){
    return {question:'एक व्यक्ति '+route+' चलता है। वह शुरूआती स्थान की किस दिशा में है?',answer:d,
      distractors:['उत्तर','दक्षिण','पूर्व','पश्चिम','उत्तर-पूर्व','उत्तर-पश्चिम','दक्षिण-पूर्व','दक्षिण-पश्चिम'].filter(v=>v!==d).slice((level*2)%5,(level*2)%5+3),
      explanation:'पूर्व-पश्चिम का शुद्ध विस्थापन '+x+' किमी और उत्तर-दक्षिण का '+y+' किमी है; इसलिए दिशा '+d+' है।'};
  }
  const distance=Math.sqrt(x*x+y*y);
  if(!Number.isInteger(distance))throw Error('distance not integer');
  return numeric('व्यक्ति '+route+' चलता है। प्रारंभिक स्थान से उसकी सीधी दूरी कितनी होगी (किमी में)?',distance,
    'शुद्ध विस्थापन = ('+x+','+y+') किमी; दूरी = √('+x*x+' + '+y*y+') = '+distance+' किमी।');
}
[
 [['पूर्व',3],['उत्तर',4]],[['पश्चिम',5],['दक्षिण',12]],
 [['उत्तर',6],['पूर्व',8]],[['दक्षिण',8],['पश्चिम',15]],
 [['पूर्व',12],['उत्तर',5]]
].forEach(m=>DIR.push(stepsQuestion(m,'distance',0)));
[
 [['पूर्व',7],['उत्तर',4],['पश्चिम',2]],[['उत्तर',9],['पश्चिम',5],['दक्षिण',3]],
 [['दक्षिण',8],['पूर्व',6],['उत्तर',2]],[['पश्चिम',10],['उत्तर',6],['पूर्व',4]],
 [['उत्तर',10],['पूर्व',9],['दक्षिण',4]]
].forEach(m=>DIR.push(stepsQuestion(m,'direction',1)));
[
 [['पूर्व',8],['उत्तर',12],['पश्चिम',5],['दक्षिण',8]],
 [['पश्चिम',14],['उत्तर',9],['पूर्व',9],['दक्षिण',5]],
 [['उत्तर',20],['पूर्व',15],['दक्षिण',8],['पश्चिम',10]],
 [['दक्षिण',18],['पश्चिम',16],['उत्तर',6],['पूर्व',7]],
 [['पूर्व',25],['उत्तर',16],['पश्चिम',10],['दक्षिण',8]]
].forEach((m,i)=>DIR.push(stepsQuestion(m,'direction',i)));
add('reasoning','direction','दिशा ज्ञान',DIR);
const C=[];
function enc(word,shift){
  return [...word].map(c=>String.fromCharCode(65+(c.charCodeAt(0)-65+shift)%26)).join('');
}
function coded(word,shift,decode=false){
  const correct=decode?word:enc(word,shift);
  const input=decode?enc(word,shift):word;
  const question=decode
    ? 'एक कूट में प्रत्येक अंग्रेज़ी अक्षर को '+shift+' स्थान आगे बढ़ाया जाता है। कूट '+input+' किस मूल शब्द के लिए है?'
    : 'यदि प्रत्येक अंग्रेज़ी अक्षर को '+shift+' स्थान आगे बढ़ाकर लिखा जाए, तो '+input+' का कूट क्या होगा?';
  const distractors=decode?[enc(word,1),enc(word,2),enc(word,3),enc(word,4),enc(word,5)].filter(v=>v!==correct).slice(0,3):
    [enc(word,shift+1),enc(word,(shift+25)%26),enc(word,shift+2)];
  return {question,answer:correct,distractors,explanation:
    'अंग्रेज़ी वर्णमाला में हर अक्षर '+shift+' स्थान '+(decode?'पीछे करके मूल शब्द':'आगे करके कूट')+' मिलता है। इसलिए उत्तर '+correct+' है।'};
}
[['CAT',1],['DOG',1],['SUN',1],['PEN',1],['BUS',1]].forEach(x=>C.push(coded(...x)));
[['MATH',2],['BOOK',2],['TRAIN',2],['POWER',3],['SCHOOL',3]].forEach(x=>C.push(coded(...x)));
[['CAT',2],['DOG',3],['SUN',2],['PEN',3],['BOOK',4]].forEach(x=>C.push(coded(...x,true)));
add('reasoning','coding','कोडिंग-डिकोडिंग',C);
function build(){
  const out=entries.map((entry,setNo)=>{
    const subject=SUBJECTS.find(s=>s.id===entry.subject);
    if(!subject)throw Error('Unknown subject: '+entry.subject);
    const id='topic-seed-up-police-'+entry.slug;
    const questions=entry.questions.map((row,i)=>{
      const {options,correctOption}=arrange(row,i);
      return {
        id:id+'-q'+String(i+1).padStart(2,'0'),
        subject:subject.name, subjectId:entry.subject,
        topic:entry.topic, topicName:entry.topic, topicId:entry.slug,
        difficulty:levels[Math.floor(i/5)], marks:1,
        question:row.question, options,correctOption,
        explanation:row.explanation,origin:'original-practice-question',
        contentStatus:'training-fixture'
      };
    });
    return {
      id,title:'UP Police · '+entry.topic+' · Topic Practice',
      description:'Original educational questions for testing topic selection, difficulty, instant feedback, saved progress and reports. Not an official or previous-year paper.',
      category:subject.name,difficulty:'Mixed',icon:'book',
      examIds:['up-police'],examId:'up-police',audience:'student',
      type:'practice',topicPracticeOnly:true,available:true,
      topicPracticeSeed:'2026-11-05-v1',paperVersion:'topic-seed-v1',
      patternStatus:'original-practice-not-official',passPercent:40,
      timing:{totalSeconds:900,questionSeconds:60,warningSeconds:10},
      defaultMode:'untimed',feedbackMode:'per-question',
      totalMarks:questions.length,negativeMarking:0,
      marking:{correct:1,incorrect:0,unanswered:0},questions
    };
  });
  const ids=new Set(),questionIds=new Set();
  let tally=0;
  for(const t of out){
    if(ids.has(t.id))throw Error('duplicate test '+t.id);ids.add(t.id);
    for(const q of t.questions){
      if(questionIds.has(q.id))throw Error('duplicate question '+q.id);questionIds.add(q.id);
      if(q.options.length!==4||new Set(q.options).size!==4||q.options[q.correctOption]===undefined||!q.explanation)throw Error('bad question '+q.id);
      tally++;
    }
  }
  if(out.length!==12||tally!==180)throw Error('unexpected dataset size '+out.length+' / '+tally);
  return out;
}
module.exports={build};
