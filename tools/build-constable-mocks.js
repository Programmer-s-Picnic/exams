/* Original practice-only full-length papers (not official PYQs).
 * Uses disjoint question sets to minimize form-to-form overlap.
 */
"use strict";
function mix(list,salt){
 const array=list.slice();
 let seed=2166136261>>>0;
 for(const c of salt)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 for(let i=array.length-1;i>0;i--){
  seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;
  const j=seed%(i+1);[array[i],array[j]]=[array[j],array[i]];
 }
 return array;
}
const distribution=[
 {name:"General Knowledge",count:38},
 {name:"General Hindi",count:37},
 {name:"Numerical and Mental Ability",count:38},
 {name:"Mental Aptitude, I.Q. and Reasoning Ability",count:37}
];
function build(allTests){
 const topics=allTests.filter(t=>t.examIds?.includes("up-police")&&t.topicPracticeOnly&&t.available);
 const allBySubject=new Map();
 for(const {name} of distribution){
  const from=topics.filter(t=>t.category===name).flatMap(t=>t.questions.map(q=>({...q,sourceQuestionId:q.id,sourceTestId:t.id})));
  if(from.length<114)throw Error("Insufficient source material for "+name+"; need >=114, got "+from.length);
  allBySubject.set(name,mix(from,"UP-POLICE-2026-v2:"+name));
 }
 const seenAcrossAllForms=new Set();
 const result=Array.from({length:3},(_,paperIndex)=>{
  const form=String.fromCharCode(65+paperIndex);
  const sections=distribution.map(({name,count})=>{
   const source=allBySubject.get(name).slice(paperIndex*count,(paperIndex+1)*count);
   if(source.length!==count)throw Error("Not enough "+name);
   return source.map(q=>({...q,marks:2,topic:q.topicName||q.topic,
    contentStatus:"educational-review-needed",origin:"original-practice-question"}));
  });
  const questions=mix(sections.flat(), "mock-paper:"+form).map((q,i)=>({
   ...q,id:"constable-full-mock-"+form.toLowerCase()+"-q"+String(i+1).padStart(3,"0")
  }));
  if(questions.length!==150)throw Error("Invalid mock length "+form);
  for(const q of questions){
   if(seenAcrossAllForms.has(q.sourceQuestionId))throw Error("Question repeated across full mocks: "+q.sourceQuestionId);
   seenAcrossAllForms.add(q.sourceQuestionId);
  }
  return {
    id:"up-police-constable-full-practice-mock-"+String(paperIndex+1).padStart(2,"0"),
    title:"UP Police Constable — Full-Length Original Mock "+form+" (150 MCQs)",
    description:"150 original practice MCQs, 300 marks and a 120-minute default timer. Subject split of 38/37/38/37 is editorial, not specified by UPPRPB. This is NOT an official or previous-year paper.",
    category:"UP Police Constable · Full-Length Mock", difficulty:"Mixed",
    examIds:["up-police"],examId:"up-police",icon:"police",
    audience:"student",type:"mock",available:true,fullMock:true,
    paperVersion:"original-full-mock-2026-v2-"+form,
    patternStatus:"original-editorial-full-length-practice",
    referenceSource:"https://uppbpb.gov.in/FilesUploaded/Notice/CONST-25OMRVIGGYAPTI05-02-2026590e47bd-d973-4a45-9007-b2a0a048b4f4.pdf",
    patternNote:"Official: 150 objective questions/300 marks/120 minutes/+2 correct; subject counts not specified. This site's division is editorial. Official 2025 process notice does not specify a negative-marking deduction. Simulation uses zero deduction.",
    subjectQuestionCounts:Object.fromEntries(distribution.map(x=>[x.name,x.count])),
    totalMarks:300,negativeMarking:0,marking:{correct:2,incorrect:0,unanswered:0},
    timing:{totalSeconds:7200,questionSeconds:48,warningSeconds:60},
    passPercent:30,defaultMode:"total-timed",feedbackMode:"on-completion",
    questions
  };
 });
 return result;
}
module.exports={build,distribution};
