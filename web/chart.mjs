// A small SVG chart helper with no dependencies. Colors come from CSS classes,
// so the page works under a strict content security policy.
const NS='http://www.w3.org/2000/svg';
const node=(name,attributes={},text)=>{
  const element=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  if(text!==undefined)element.textContent=text;
  return element;
};
const niceStep=span=>{
  const raw=span/5,magnitude=10**Math.floor(Math.log10(raw||1)),scaled=raw/magnitude;
  return (scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*magnitude;
};
const format=value=>Math.abs(value)>=1000?value.toLocaleString('en-US'):String(Math.round(value*100)/100);

export function chart(target,{title,description,series=[],xTicks,xLabel='',yLabel='',xFormat=format,yFormat=format,height=300,marker=null}) {
  const width=720,left=62,right=16,top=14,bottom=xLabel?56:34;
  const points=series.flatMap(item=>item.points.flatMap(point=>item.kind==='band'?[{x:point.x,y:point.low},{x:point.x,y:point.high}]:item.kind==='bars'?[{x:point.x0,y:0},{x:point.x1,y:point.y}]:[point]));
  let xMin=Math.min(...points.map(point=>point.x)),xMax=Math.max(...points.map(point=>point.x));
  let yMin=Math.min(...points.map(point=>point.y)),yMax=Math.max(...points.map(point=>point.y));
  if(xMin===xMax){xMin-=1;xMax+=1;}
  if(yMin===yMax){yMin-=1;yMax+=1;}
  const yStep=niceStep(yMax-yMin);
  yMin=Math.floor(yMin/yStep)*yStep;yMax=Math.ceil(yMax/yStep)*yStep;
  const x=value=>left+(value-xMin)/(xMax-xMin)*(width-left-right);
  const y=value=>height-bottom-(value-yMin)/(yMax-yMin)*(height-top-bottom);
  const svg=node('svg',{viewBox:`0 0 ${width} ${height}`,class:'chart',role:'img','aria-label':title});
  svg.append(node('title',{},title));
  if(description)svg.append(node('desc',{},description));
  for(let value=yMin;value<=yMax+yStep/2;value+=yStep){
    svg.append(node('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'chart-grid'}));
    svg.append(node('text',{x:left-8,y:y(value)+4,'text-anchor':'end',class:'chart-tick'},yFormat(value)));
  }
  const ticks=xTicks||Array.from({length:6},(_,index)=>({x:xMin+(xMax-xMin)*index/5}));
  for(const tick of ticks)svg.append(node('text',{x:x(tick.x),y:height-bottom+18,'text-anchor':'middle',class:'chart-tick'},tick.label??xFormat(tick.x)));
  if(xLabel)svg.append(node('text',{x:(left+width-right)/2,y:height-10,'text-anchor':'middle',class:'chart-label'},xLabel));
  if(yLabel)svg.append(node('text',{transform:`translate(13 ${(top+height-bottom)/2}) rotate(-90)`,'text-anchor':'middle',class:'chart-label'},yLabel));
  for(const item of series){
    if(item.kind==='band'){
      const upper=item.points.map(point=>`${x(point.x)},${y(point.high)}`),lower=[...item.points].reverse().map(point=>`${x(point.x)},${y(point.low)}`);
      svg.append(node('polygon',{points:[...upper,...lower].join(' '),class:`chart-band ${item.className||''}`}));
    } else if(item.kind==='bars'){
      for(const bar of item.points)svg.append(node('rect',{x:x(bar.x0)+0.5,width:Math.max(1,x(bar.x1)-x(bar.x0)-1),y:y(bar.y),height:y(0)-y(bar.y),class:`chart-bar ${item.className||''}`}));
    } else if(item.kind==='dots'){
      for(const dot of item.points)svg.append(node('circle',{cx:x(dot.x),cy:y(dot.y),r:2,class:`chart-dot ${item.className||''}`}));
    } else {
      svg.append(node('polyline',{points:item.points.map(point=>`${x(point.x)},${y(point.y)}`).join(' '),class:`chart-line ${item.className||''}`}));
    }
  }
  if(marker){
    svg.append(node('line',{x1:x(marker.x),x2:x(marker.x),y1:top,y2:height-bottom,class:'chart-marker'}));
    svg.append(node('text',{x:x(marker.x)+6,y:top+12,class:'chart-tick'},marker.label));
  }
  const legendItems=series.filter(item=>item.label);
  const figure=document.createElement('figure');
  figure.className='chart-figure';
  figure.append(svg);
  if(legendItems.length){
    const legend=document.createElement('figcaption');
    legend.className='chart-legend';
    for(const item of legendItems){
      const entry=document.createElement('span'),swatch=document.createElement('i');
      swatch.className=`legend-swatch ${item.kind==='band'?'legend-band':''} ${item.className||''}`;
      entry.append(swatch,document.createTextNode(item.label));
      legend.append(entry);
    }
    figure.append(legend);
  }
  target.replaceChildren(figure);
}
