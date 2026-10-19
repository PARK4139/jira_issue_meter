function renderSingleGraph(period,container){
const projects=loadedProjectReports.map(project=>({project,rows:project.datasets[period]})).filter(item=>item.rows?.length);
if(!projects.length)return;
const unresolvedMode=calcMode==='unresolved';
for(const item of projects){item.values=unresolvedMode?item.rows.map(row=>Number(row.unresolved||0)):cumulativeRows(item.rows).map(row=>row.created?row.resolved/row.created*100:null)}
const allValues=projects.flatMap(item=>item.values.filter(value=>value!==null));
const maxY=unresolvedMode?Math.max(4,Math.ceil(Math.max(1,...allValues)/4)*4):Math.max(100,Math.ceil(Math.max(1,...allValues)/10)*10),L=70,R=1037,T=35,B=Math.max(320,T+projects.length*18+16);
const seriesColor=projectIndex=>'hsl('+Math.round(projectIndex*137.508%360)+' 70% 48%)';
const formatValue=value=>value===null?'\u2014':Number(value).toLocaleString(locale,unresolvedMode?{}:{minimumFractionDigits:1,maximumFractionDigits:1})+(unresolvedMode?'':'%');
const shortProjectName=name=>{let result='',width=0;for(const char of name){const advance=/[^\u0000-\u00ff]/.test(char)?16:8;if(width+advance>152)return result+'\u2026';result+=char;width+=advance}return result};
const section=document.createElement('section');section.className='project-report single-graph';section.setAttribute('aria-label',t('singleGraphAria'));
const heading=document.createElement('h3');heading.textContent=t('singleGraphHeading');section.append(heading);
const chart=document.createElementNS(ns,'svg');chart.setAttribute('viewBox','0 0 1320 '+(B+90));chart.setAttribute('role','img');chart.setAttribute('aria-label',t('singleGraphAria')+' - '+titles[period]);
const append=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;chart.append(node);return node};
const x=(i,count)=>count===1?(L+R)/2:L+(R-L)*i/(count-1),y=value=>B-(B-T)*value/maxY;
for(let i=0;i<=4;i++){const value=maxY*i/4;append('line',{x1:L,y1:y(value),x2:R,y2:y(value),stroke:'#34465e'});append('text',{x:52,y:y(value)+4,fill:'#a5b6cc','font-size':15,'text-anchor':'end'},unresolvedMode?value:Math.round(value)+'%')}
const labels=projects[0].rows;labels.forEach((row,i)=>{if(i%Math.max(1,Math.ceil(labels.length/12))===0||i===labels.length-1)append('text',{x:x(i,labels.length),y:B+30,fill:'#a5b6cc','font-size':14,'text-anchor':'end',transform:'rotate(-30 '+x(i,labels.length)+' '+(B+30)+')'},row.label)});
const dots=[];
projects.forEach(({project,rows,values},projectIndex)=>{
const color=seriesColor(projectIndex);let started=false,pathData='';
values.forEach((value,i)=>{if(value===null){started=false;return}pathData+=(started?'L':'M')+x(i,rows.length)+','+y(value);started=true});
append('path',{d:pathData,stroke:color,'stroke-width':3,fill:'none',pathLength:1000,class:'series-line'});
values.forEach((value,i)=>{if(value===null)return;const circle=append('circle',{cx:x(i,rows.length),cy:y(value),r:rows.length>60?1.5:3.5,fill:color,class:'series-dot'});circle.style.setProperty('--i',String(i));(dots[i]??=[]).push(circle)})
});
const endLabels=projects.map(({project,values},projectIndex)=>({project,value:values.at(-1),rawY:values.at(-1)===null?B:y(values.at(-1)),color:seriesColor(projectIndex)})).sort((a,b)=>Number(a.value===null)-Number(b.value===null)||a.rawY-b.rawY),labelTop=T+8,labelBottom=B-8,labelGap=Math.min(18,(labelBottom-labelTop)/Math.max(1,endLabels.length-1));
endLabels.forEach((item,index)=>{item.labelY=Math.max(labelTop,Math.min(labelBottom,item.rawY));if(index)item.labelY=Math.max(item.labelY,endLabels[index-1].labelY+labelGap)});
if(endLabels.length)endLabels.at(-1).labelY=Math.min(labelBottom,endLabels.at(-1).labelY);
for(let i=endLabels.length-2;i>=0;i--)endLabels[i].labelY=Math.min(endLabels[i].labelY,endLabels[i+1].labelY-labelGap);
for(const {project,value,rawY,labelY,color} of endLabels){if(Math.abs(rawY-labelY)>4)append('line',{x1:R+2,y1:rawY,x2:R+12,y2:labelY,stroke:color,'stroke-width':1,'data-series':'true'});const name=append('text',{x:R+17,y:labelY+5,fill:color,'data-series':'true','font-size':16,'font-weight':600},shortProjectName(project.name)),nameTitle=document.createElementNS(ns,'title');nameTitle.textContent=project.name;name.append(nameTitle);append('text',{x:1300,y:labelY+5,fill:color,'data-series':'true','font-size':16,'font-weight':600,'text-anchor':'end',style:'font-variant-numeric:tabular-nums'},formatValue(value))}
const guide=append('line',{x1:L,y1:T,x2:L,y2:B,class:'hover-line',stroke:'#94a6bd','stroke-width':1,visibility:'hidden'});
const capture=append('rect',{x:L-8,y:T-12,width:R-L+16,height:B-T+12,fill:'transparent',class:'hover-capture'});
const tip=document.createElement('div');tip.className='chart-tip';tip.hidden=true;tip.setAttribute('role','status');
const hideHover=()=>{guide.setAttribute('visibility','hidden');dots.flat().forEach(circle=>circle.setAttribute('class','series-dot'));tip.hidden=true};
const showHover=event=>{const box=chart.getBoundingClientRect(),host=section.getBoundingClientRect(),svgX=(event.clientX-box.left)*1320/(box.width||1320),count=labels.length,index=count===1?0:Math.max(0,Math.min(count-1,Math.round((svgX-L)/(R-L)*(count-1))));
guide.setAttribute('x1',x(index,count));guide.setAttribute('x2',x(index,count));guide.setAttribute('visibility','visible');dots.flat().forEach(circle=>circle.setAttribute('class','series-dot hot'));tip.replaceChildren();
const range=document.createElement('strong');range.textContent=labels[index].start+' ~ '+labels[index].end;tip.append(range);
for(const {project,values} of projects){const value=document.createElement('span');value.className='tip-row';value.textContent=project.name+' ('+project.key+') · '+(unresolvedMode?t('unresolved'):t('ratio'))+': '+formatValue(values[index]);tip.append(value)}
tip.hidden=false;const width=tip.offsetWidth||0,left=event.clientX-host.left+16;tip.style.left=Math.max(8,left+width>host.width-8?event.clientX-host.left-16-width:left)+'px';tip.style.top=Math.max(8,event.clientY-host.top-12)+'px'};
capture.addEventListener('pointermove',showHover);capture.addEventListener('pointerdown',showHover);capture.addEventListener('pointerleave',hideHover);capture.addEventListener('pointercancel',hideHover);
section.append(chart,tip);
const details=document.createElement('details'),caption=document.createElement('summary');caption.dataset.text='details';caption.textContent='JQL FOR DATA PROOF';details.append(caption);
for(const {project,rows} of projects){
const projectHeading=document.createElement('h4');projectHeading.textContent=project.name+' ('+project.key+')';details.append(projectHeading);
const table=document.createElement('table'),head=document.createElement('tr');for(const text of ['Period [start, end)','Created','Resolved',...(unresolvedMode?['Unresolved']:[]),'JQL']){const th=document.createElement('th');th.textContent=text;head.append(th)}table.append(head);
for(const row of rows){const tr=document.createElement('tr');for(const value of [row.start+' / '+row.end,row.created,row.resolved,...(unresolvedMode?[row.unresolved??'\u2014']:[])]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td');for(const field of ['created','resolved',...(row.queries.unresolved?['unresolved']:[])]){const pre=document.createElement('pre');pre.textContent=row.queries[field];td.append(pre)}tr.append(td);table.append(tr)}details.append(table)
}
section.append(details);container.append(section)
}
const renderCombined=render;
render=function(period){
const unresolvedMode=calcMode==='unresolved',periodic=calcMode==='periodic';
renderCombined(period);byId('summary').replaceChildren();byId('combined-chart').hidden=true;byId('combined-table').hidden=true;
const container=byId('project-graphs');container.replaceChildren();
if(chartLayout==='single')renderSingleGraph(period,container);
else for(const project of loadedProjectReports){
const rows=project.datasets[period],section=document.createElement('section');section.className='project-report';section.setAttribute('aria-label',project.name+' ('+project.key+')');
const chartRows=periodic?rows:cumulativeRows(rows);
const heading=document.createElement('h3');heading.textContent=project.name+' ('+project.key+')';section.append(heading);
const summary=document.createElement('p');if(unresolvedMode){const span=document.createElement('span');span.className='blue';span.dataset.metric='unresolved';span.dataset.count=String(rows.at(-1)?.unresolved??0);span.textContent=t('unresolved')+': '+span.dataset.count;summary.append(span)}else for(const [field,label,color] of [['created','Created','red'],['resolved','Resolved','green']]){const span=document.createElement('span');span.className=color;span.dataset.metric=field;span.dataset.count=String(cumulativeTotals(rows)[field]);span.textContent=label+': '+span.dataset.count+'   ';summary.append(span)}
section.append(summary);
const chart=document.createElementNS(ns,'svg');chart.setAttribute('viewBox','0 0 1060 410');chart.setAttribute('role','img');chart.setAttribute('aria-label',project.name+' '+titles[period]+(unresolvedMode?' Unresolved trend':periodic?' Created / Resolved per period':' Cumulative Created / Resolved'));
const append=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;chart.append(node);return node};
const L=69,R=1037,T=30,B=320,maxY=Math.max(4,Math.ceil(Math.max(1,...chartRows.flatMap(row=>unresolvedMode?[row.unresolved||0]:[row.created,row.resolved]))/4)*4),x=i=>rows.length===1?(L+R)/2:L+(R-L)*i/(rows.length-1),y=value=>B-(B-T)*value/maxY;
for(let i=0;i<=4;i++){const value=maxY*i/4;append('line',{x1:L,y1:y(value),x2:R,y2:y(value),stroke:'#34465e'});append('text',{x:52,y:y(value)+4,fill:'#a5b6cc','font-size':13,'text-anchor':'end'},value)}
rows.forEach((row,i)=>{if(i%Math.max(1,Math.ceil(rows.length/12))===0||i===rows.length-1)append('text',{x:x(i),y:B+30,fill:'#a5b6cc','font-size':12,'text-anchor':'end',transform:'rotate(-30 '+x(i)+' '+(B+30)+')'},row.label)});
const dots=[];
for(const [field,color] of (unresolvedMode?[['unresolved','#4c9aff']]:[['created','#ff6876'],['resolved','#5bd4a4']])){append('path',{d:chartRows.map((row,i)=>(i?'L':'M')+x(i)+','+y(row[field]||0)).join(' '),stroke:color,'stroke-width':3,fill:'none',pathLength:1,class:'series-line'});chartRows.forEach((row,i)=>{const circle=append('circle',{cx:x(i),cy:y(row[field]||0),r:rows.length>60?1.5:3.5,fill:color,class:'series-dot'}),title=document.createElementNS(ns,'title');if(unresolvedMode){title.dataset.unresolvedValue=String(row.unresolved||0)}else if(periodic){title.dataset.periodField=field;title.dataset.periodValue=String(row[field])}else{title.dataset.cumulativeField=field;title.dataset.cumulativeValue=String(row[field])}title.dataset.periodStart=row.start;title.dataset.periodEnd=row.end;title.textContent=project.name+' '+row.start+(unresolvedMode||periodic?' ':' cumulative ')+field+': '+(row[field]||0);circle.style.setProperty('--i',String(i));(dots[i]??=[]).push(circle);circle.append(title)})}
const sumOf=field=>cumulativeTotals(rows)[field],ratioNode=append('text',{x:R,y:16,fill:'#5e6c84','font-size':16,'font-weight':600,'text-anchor':'end'});
ratioNode.dataset.ratio=sumOf('created')?(sumOf('resolved')/sumOf('created')*100).toFixed(1)+'%':'\u2014';ratioNode.textContent=t('ratio')+': '+ratioNode.dataset.ratio;
// Hover: vertical guide, highlighted points, and a tooltip with the cumulative values of the nearest period.
const guide=append('line',{x1:L,y1:T,x2:L,y2:B,class:'hover-line',stroke:'#94a6bd','stroke-width':1,visibility:'hidden'});
const capture=append('rect',{x:L-8,y:T-12,width:R-L+16,height:B-T+12,fill:'transparent',class:'hover-capture'});
const tip=document.createElement('div');tip.className='chart-tip';tip.hidden=true;tip.setAttribute('role','status');
const activeDot=active=>dots.forEach((pair,j)=>pair.forEach(circle=>circle.setAttribute('class',j===active?'series-dot hot':'series-dot')));
const hideHover=()=>{guide.setAttribute('visibility','hidden');activeDot(-1);tip.hidden=true};
const showHover=event=>{
const box=chart.getBoundingClientRect(),host=section.getBoundingClientRect();
const svgX=(event.clientX-box.left)*1060/(box.width||1060);
const index=rows.length===1?0:Math.max(0,Math.min(rows.length-1,Math.round((svgX-L)/(R-L)*(rows.length-1))));
const row=rows[index],point=chartRows[index];
guide.setAttribute('x1',x(index));guide.setAttribute('x2',x(index));guide.setAttribute('visibility','visible');activeDot(index);
tip.replaceChildren();
const title=document.createElement('strong');title.textContent=project.name+' ('+project.key+')';
const range=document.createElement('span');range.className='tip-range';range.textContent=row.start+' ~ '+row.end;
tip.append(title,range);
for(const [field,color] of (unresolvedMode?[['unresolved','blue']]:[['created','red'],['resolved','green']])){
const line=document.createElement('span');line.className='tip-row '+color;
line.textContent=unresolvedMode?t('unresolved')+': '+Number(row.unresolved||0).toLocaleString(locale):periodic?t(field)+': '+Number(point[field]).toLocaleString(locale):t('cumulative')+' '+t(field)+': '+Number(point[field]).toLocaleString(locale)+' (+'+Number(row[field]).toLocaleString(locale)+')';tip.append(line)}
const ratio=document.createElement('span');ratio.className='tip-row';ratio.textContent=t('ratio')+': '+(point.created?(point.resolved/point.created*100).toFixed(1)+'%':'\u2014');tip.append(ratio);
tip.hidden=false;
const width=tip.offsetWidth||0,left=event.clientX-host.left+16;
tip.style.left=Math.max(8,left+width>host.width-8?event.clientX-host.left-16-width:left)+'px';
tip.style.top=Math.max(8,event.clientY-host.top-12)+'px';
};
capture.addEventListener('pointermove',showHover);capture.addEventListener('pointerdown',showHover);capture.addEventListener('pointerleave',hideHover);capture.addEventListener('pointercancel',hideHover);
section.append(chart,tip);
const details=document.createElement('details'),caption=document.createElement('summary');caption.dataset.text='details';caption.textContent='JQL FOR DATA PROOF';details.append(caption);
const table=document.createElement('table'),head=document.createElement('tr');for(const text of ['Period [start, end)','Created','Resolved',...(unresolvedMode?['Unresolved']:[]),'JQL']){const th=document.createElement('th');th.textContent=text;head.append(th)}table.append(head);
for(const row of rows){const tr=document.createElement('tr');for(const value of [row.start+' / '+row.end,row.created,row.resolved,...(unresolvedMode?[row.unresolved??'\u2014']:[])]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td');for(const field of ['created','resolved',...(row.queries.unresolved?['unresolved']:[])]){const pre=document.createElement('pre');pre.textContent=row.queries[field];td.append(pre)}tr.append(td);table.append(tr)}details.append(table);section.append(details);container.append(section);
}
const guides=document.createElement('section');guides.className='chart-guides';guides.setAttribute('aria-labelledby','chart-guides-heading');
const guideHeading=document.createElement('h3');guideHeading.id='chart-guides-heading';guideHeading.dataset.text='chartGuideHeading';guideHeading.textContent=t('chartGuideHeading');guides.append(guideHeading);
const points=document.createElement('ul'),keys=unresolvedMode?['guideUnresolved1','guideUnresolved3']:chartLayout==='single'?['guideSingleRatio1','guideSingleRatio2']:periodic?['guidePeriodic1','guidePeriodic3']:['guideCumulative1','guideCumulative3'];
for(const key of keys){const point=document.createElement('li');point.dataset.text=key;point.textContent=t(key);points.append(point)}
guides.append(points);
container.append(guides);
};
