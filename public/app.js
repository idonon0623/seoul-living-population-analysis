/* Assignment 3: local aggregate data only; no external map tiles or API keys. */
'use strict';
const $ = id => document.getElementById(id);
const fmt = (n, digits=0) => Number(n).toLocaleString('ko-KR',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const teal = '#12665e', coral = '#b8583e';
const baseLayout = {font:{family:'Pretendard, Noto Sans KR, Malgun Gothic, sans-serif',size:12,color:'#243d3a'},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',margin:{l:65,r:25,t:25,b:60},hoverlabel:{font:{family:'Malgun Gothic',size:12}},xaxis:{gridcolor:'#e0e5df',zeroline:false},yaxis:{gridcolor:'#e0e5df',zeroline:false}};
const config={responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d'],toImageButtonOptions:{format:'svg',filename:'seoul-assignment3',width:1000,height:650}};
let data, geo, selected, district='', byCode, mapPaths=[], densityCuts;
const palettes={day_density:['#e4eee8','#b6d3c6','#78af99','#38816c','#145344'],day_lq:['#587eac','#a0bdd3','#e8e6d9','#dcac73','#b86234']};
const quantile=(a,p)=>{const i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);};
const fields={density:['day_density','주간 생활인구 밀도','명/km²'],lq:['day_lq','주간 특화도 LQ',''],day_night:['day_night_ratio','주야 인구비','배']};
function mapColor(row,field){const cuts=field==='day_density'?densityCuts:[0.8,0.95,1.05,1.2];return palettes[field][cuts.filter(x=>row[field]>x).length];}
function legend(field,id){const cuts=field==='day_density'?densityCuts:[0.8,0.95,1.05,1.2], d=field==='day_density'?0:2;$(id).innerHTML=palettes[field].map((c,i)=>`<span><i style="display:inline-block;width:14px;height:14px;background:${c};margin-right:6px"></i>${i===0?'≤ '+fmt(cuts[0],d):i===4?'> '+fmt(cuts[3],d):fmt(cuts[i-1],d)+'–'+fmt(cuts[i],d)}</span>`).join(' ');}
function drawMaps(){
 const coords=[];const scan=c=>typeof c[0]==='number'?coords.push(c):c.forEach(scan);geo.features.forEach(f=>scan(f.geometry.coordinates));
 const lat0=37.55*Math.PI/180, xx=c=>c[0]*Math.cos(lat0), yy=c=>-c[1];
 const xmin=Math.min(...coords.map(xx)),xmax=Math.max(...coords.map(xx)),ymin=Math.min(...coords.map(yy)),ymax=Math.max(...coords.map(yy));
 const scale=Math.min(570/(xmax-xmin),490/(ymax-ymin));const ox=25+(570-(xmax-xmin)*scale)/2,oy=25+(490-(ymax-ymin)*scale)/2;
 const point=c=>[(xx(c)-xmin)*scale+ox,(yy(c)-ymin)*scale+oy];
 const ring=c=>c.map((p,i)=>(i?'L':'M')+point(p).map(x=>x.toFixed(2)).join(',')).join('')+'Z';
 const path=g=>(g.type==='Polygon'?g.coordinates:[].concat(...g.coordinates)).map(ring).join('');
 for(const [field,id] of [['day_density','density-map'],['day_lq','lq-map']]){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 620 550');svg.setAttribute('role','img');svg.setAttribute('aria-label',field==='day_density'?'서울 426개 행정동 주간 생활인구 밀도 지도':'서울 426개 행정동 주간 특화도 지도');
  geo.features.forEach(f=>{const r=byCode.get(String(f.properties.code));if(!r)return;const p=document.createElementNS(ns,'path');p.setAttribute('d',path(f.geometry));p.setAttribute('fill',mapColor(r,field));p.setAttribute('stroke','#fafbf7');p.setAttribute('stroke-width','.65');p.setAttribute('fill-rule','evenodd');p.style.cursor='pointer';const t=document.createElementNS(ns,'title');t.textContent=`${r.district} ${r.name}\n밀도 ${fmt(r.day_density)}명/km² · LQ ${fmt(r.day_lq,2)}`;p.append(t);p.addEventListener('click',()=>choose(r.code));svg.append(p);mapPaths.push({p,r});});
  const north=document.createElementNS(ns,'text');north.setAttribute('x','580');north.setAttribute('y','32');north.setAttribute('font-size','15');north.textContent='↑ N';svg.append(north);
  const bar=document.createElementNS(ns,'path');const w=5/111.32*scale;bar.setAttribute('d',`M35 520h${w.toFixed(1)}M35 516v8M${(35+w).toFixed(1)} 516v8`);bar.setAttribute('stroke','#314a43');svg.append(bar);const st=document.createElementNS(ns,'text');st.setAttribute('x','35');st.setAttribute('y','508');st.setAttribute('font-size','11');st.textContent='약 5 km';svg.append(st);$(id).replaceChildren(svg);
 }
 legend('day_density','density-legend');legend('day_lq','lq-legend');
}
function filtered(){return data.rows.filter(r=>!district||r.district===district);}
function options(){ $('dong-select').innerHTML=filtered().map(r=>`<option value="${esc(r.code)}">${esc(r.district)} ${esc(r.name)}</option>`).join(''); }
function choose(code){const r=byCode.get(String(code));if(!r)return;if(district&&r.district!==district){district='';$('district-filter').value='';options();}selected=r.code;$('dong-select').value=r.code;update();}
function update(){
 const r=byCode.get(String(selected));
 mapPaths.forEach(({p,r:v})=>{const on=v.code===selected;p.setAttribute('stroke',on?'#151f1d':'#fafbf7');p.setAttribute('stroke-width',on?'2.6':'.65');p.style.opacity=district&&v.district!==district?'.18':'1';if(on)p.parentNode.append(p);});
 $('dong-detail').innerHTML=`<div><span>선택한 행정동</span><h3>${esc(r.district)} ${esc(r.name)}</h3></div><div>주간 밀도<strong>${fmt(r.day_density)} <small>명/km²</small></strong></div><div>주간 LQ<strong>${fmt(r.day_lq,2)}</strong></div><div>주야 인구비<strong>${fmt(r.day_night_ratio,2)} <small>배</small></strong></div><p>주간 평균 ${fmt(r.day_population)}명 · 심야 평균 ${fmt(r.night_population)}명 · 면적 ${fmt(r.area_km2,2)}km²</p>`;
 const rows=filtered();
 Plotly.react('scatter-chart',[{type:'scatter',mode:'markers',x:rows.map(v=>v.day_density),y:rows.map(v=>v.day_lq),customdata:rows.map(v=>v.code),text:rows.map(v=>v.district+' '+v.name),marker:{size:rows.map(v=>v.code===selected?13:7),color:rows.map(v=>v.code===selected?coral:teal),opacity:.72},hovertemplate:'%{text}<br>밀도 %{x:,.0f}명/km²<br>LQ %{y:.3f}<extra></extra>'}],{...baseLayout,xaxis:{...baseLayout.xaxis,title:{text:'주간 생활인구 밀도 (명/km²)'}},yaxis:{...baseLayout.yaxis,title:{text:'주간 특화도 LQ'}},shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:1,y1:1,line:{color:'#9a9e95',dash:'dot'}}]},config);
 drawRank();
 const norm=a=>{const m=a.reduce((s,v)=>s+v,0)/a.length;return a.map(v=>v/m*100);};
 Plotly.react('hourly-chart',[{type:'scatter',mode:'lines+markers',name:r.name,x:Array.from({length:24},(_,i)=>i),y:norm(r.hourly),line:{color:teal,width:3},hovertemplate:'%{x}시 · %{y:.1f}<extra>'+esc(r.name)+'</extra>'},{type:'scatter',mode:'lines',name:'서울 전체',x:Array.from({length:24},(_,i)=>i),y:norm(data.city.hourly),line:{color:'#a79e8a',dash:'dot',width:2},hovertemplate:'%{x}시 · %{y:.1f}<extra>서울 전체</extra>'}],{...baseLayout,showlegend:true,legend:{orientation:'h',y:1.15},xaxis:{...baseLayout.xaxis,title:{text:'시간 (시)'},dtick:3,range:[0,23]},yaxis:{...baseLayout.yaxis,title:{text:'24시간 평균 = 100'}},shapes:[{type:'rect',xref:'x',yref:'paper',x0:8.5,x1:17.5,y0:0,y1:1,fillcolor:'#12665e',opacity:.06,line:{width:0},layer:'below'}]},config);
}
function drawRank(){const [field,label,unit]=fields[$('rank-metric').value]||fields.density;const sorted=filtered().slice().sort((a,b)=>b[field]-a[field]);let rows=sorted.length>15?[...sorted.slice(0,10),...sorted.slice(-5)]:sorted;rows=rows.reverse();Plotly.react('rank-chart',[{type:'bar',orientation:'h',x:rows.map(r=>r[field]),y:rows.map(r=>r.district+' '+r.name),customdata:rows.map(r=>r.code),marker:{color:rows.map(r=>r.code===selected?coral:teal)},hovertemplate:'%{y}<br>%{x:,.3f} '+unit+'<extra></extra>'}],{...baseLayout,margin:{l:135,r:25,t:15,b:50},xaxis:{...baseLayout.xaxis,title:{text:label+(unit?' ('+unit+')':'')}},yaxis:{...baseLayout.yaxis,type:'category',automargin:true}},config);}
function findings(){
 const top=k=>data.rows.slice().sort((a,b)=>b[k]-a[k]);const d=top('day_density'),l=top('day_lq'),ratio=top('day_night_ratio');
 const n=data.rows.length,mx=data.rows.reduce((s,r)=>s+r.day_density,0)/n,my=data.rows.reduce((s,r)=>s+r.day_lq,0)/n;
 const corr=data.rows.reduce((s,r)=>s+(r.day_density-mx)*(r.day_lq-my),0)/Math.sqrt(data.rows.reduce((s,r)=>s+(r.day_density-mx)**2,0)*data.rows.reduce((s,r)=>s+(r.day_lq-my)**2,0));
 $('kpi-count').textContent=fmt(n);$('kpi-density').textContent=fmt(d[0].day_density);$('kpi-lq').textContent=fmt(l[0].day_lq,2);$('kpi-correlation').textContent=fmt(corr,2);
 if($('kpi-density-note'))$('kpi-density-note').textContent=d[0].district+' '+d[0].name+' · 명/km²';if($('kpi-lq-note'))$('kpi-lq-note').textContent=l[0].district+' '+l[0].name+' · 서울 기준 1';
 const dn=r=>`${esc(r.district)} ${esc(r.name)}`;
 const item=(title,body)=>`<article><h3>${title}</h3><p>${body}</p></article>`;
 $('findings').innerHTML=item('01. 가장 조밀한 낮과 가장 특화된 낮',`주간 인구밀도는 ${dn(d[0])}(${fmt(d[0].day_density)}명/km²), ${dn(d[1])}(${fmt(d[1].day_density)}명/km²), ${dn(d[2])}(${fmt(d[2].day_density)}명/km²) 순으로 높다. 주간 특화도는 ${dn(l[0])}(LQ ${fmt(l[0].day_lq,2)}), ${dn(l[1])}(${fmt(l[1].day_lq,2)}), ${dn(l[2])}(${fmt(l[2].day_lq,2)}) 순이다. 밀도는 한정된 면적에 존재하는 인구의 규모를, LQ는 하루 중 주간에 인구가 배분되는 상대적 정도를 보여준다.`)+item('02. 두 지표가 함께 말하는 도시 구조',`426개 동의 밀도와 LQ 간 피어슨 상관계수는 ${fmt(corr,3)}이다. 이 값은 행정동별 관측의 기술적 관계이며 인과관계를 뜻하지 않는다. LQ가 높은 지역은 서울 전체보다 낮 시간의 비중이 큰 곳이다. 도심·업무지의 통근과 상업 활동이라는 도시 구조 해석과 부합할 수 있지만, 일자리·토지이용 자료를 직접 결합하지 않았으므로 업무 기능의 효과를 확인한 것은 아니다.`)+item('03. 낮은 값은 서로 다른 이유에서 나온다',`밀도가 낮은 지역은 ${dn(d.at(-1))}(${fmt(d.at(-1).day_density)}명/km²), ${dn(d.at(-2))}(${fmt(d.at(-2).day_density)}명/km²), ${dn(d.at(-3))}(${fmt(d.at(-3).day_density)}명/km²)이다. 넓은 행정동의 산지·녹지·하천 등이 분모에 포함되면 개발된 부분의 혼잡과 전체 면적당 밀도는 달라질 수 있다. LQ가 낮은 ${dn(l.at(-1))}(${fmt(l.at(-1).day_lq,2)}), ${dn(l.at(-2))}(${fmt(l.at(-2).day_lq,2)})는 상대적으로 심야·저녁 비중이 큰 곳이다. 낮은 LQ만으로 인구 감소나 공공시설 부족을 판단할 수 없다.`)+item('04. 시간에 따라 달라지는 서비스 수요',`${dn(ratio[0])}의 주야 인구비는 ${fmt(ratio[0].day_night_ratio,2)}배다. 같은 지역에서도 서비스 이용 인구는 시간에 따라 달라진다. 주간 밀도가 높은 지역은 교통·보행·휴식 공간의 주간 수요를 추가 조사할 후보가 된다. 주거 성격이 강한 곳의 수요는 저녁·심야 관측과 함께 읽어야 한다. 시설 공급량·수용력·이동 경로를 관측하지 않았으므로 실제 서비스 부족 여부와 투자 우선순위는 후속 분석이 필요하다.`);
 const h=data.rows.find(r=>r.name==='행당2동'),y=data.rows.find(r=>r.name==='여의동');
 const comparison=document.createElement('article');comparison.innerHTML=`<h3>05. 행당2동과 여의동을 함께 읽기</h3><p>성동구 행당2동은 밀도 ${fmt(h.day_density)}명/km²로 동별 중앙값 ${fmt(data.summary.median_density)}명/km²보다 높지만 LQ는 ${fmt(h.day_lq,2)}다. 영등포구 여의동은 밀도 ${fmt(y.day_density)}명/km²로 중앙값보다 낮아도 LQ는 ${fmt(y.day_lq,2)}다. 여의동의 주간 평균 인구는 ${fmt(y.day_population)}명에 이르지만 넓은 면적(${fmt(y.area_km2,2)}km²)이 밀도를 낮춘다. 따라서 규모·면적·시간적 집중을 함께 해석해야 한다. 밀도 중앙값과 LQ 1을 기준으로 나누면 고밀도·주간특화 67개 동, 고밀도·비특화 146개 동, 저밀도·주간특화 39개 동, 저밀도·비특화 174개 동이다. 이는 자료 내부 비교용 분류이며 정책적 적정 기준은 아니다.</p>`;$('findings').append(comparison);
}
async function init(){try{
 const responses=await Promise.all(['data/analysis.json','data/geometry.geojson'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('자료 응답 '+r.status);return r.json();})));[data,geo]=responses;byCode=new Map(data.rows.map(r=>[String(r.code),r]));
 densityCuts=[.2,.4,.6,.8].map(p=>quantile(data.rows.map(r=>r.day_density).sort((a,b)=>a-b),p));
 $('district-filter').innerHTML='<option value="">서울 전체 · 25개 자치구</option>'+[...new Set(data.rows.map(r=>r.district))].sort().map(d=>`<option>${esc(d)}</option>`).join('');
 options();selected=(data.rows.find(r=>r.name==='명동')||data.rows[0]).code;drawMaps();findings();$('dong-select').value=selected;update();
 $('district-filter').addEventListener('change',e=>{district=e.target.value;options();selected=filtered()[0].code;$('dong-select').value=selected;update();});$('dong-select').addEventListener('change',e=>choose(e.target.value));$('rank-metric').addEventListener('change',drawRank);
 for(const id of ['scatter-chart','rank-chart'])$(id).on('plotly_click',e=>{if(e.points[0]?.customdata)choose(e.points[0].customdata);});
 $('data-status').textContent='426개 행정동 자료 불러오기 완료 · 지도 또는 그래프를 눌러 지역을 비교하세요.';
}catch(err){$('data-status').textContent='자료를 불러오지 못했습니다. 새로고침해 주세요. ('+err.message+')';console.error(err);}}
init();
