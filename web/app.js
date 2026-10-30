import {histogram,simulate} from '../src/model.mjs';
import {chart} from './chart.mjs';

const root=document.getElementById('project-app');
const state={impliedVol:0.2,realizedVol:0.25,hedgesPerYear:252,time:0.25,costBps:0};
const percent=value=>`${Math.round(value*100)}%`;
const controls=[
  {key:'impliedVol',label:'Implied volatility paid',min:0.1,max:0.5,step:0.01,show:percent},
  {key:'realizedVol',label:'Realized volatility',min:0.05,max:0.6,step:0.01,show:percent},
  {key:'time',label:'Time to expiry',min:0.08,max:1,step:0.01,show:value=>`${Math.round(value*12)} months`},
  {key:'costBps',label:'Cost per trade',min:0,max:20,step:1,show:value=>`${value} bps`}
];
const frequencies=[[52,'Weekly'],[252,'Daily'],[1008,'Four times a day']];
const element=(name,className,text)=>{
  const item=document.createElement(name);
  if(className)item.className=className;
  if(text!==undefined)item.textContent=text;
  return item;
};

const form=element('form','lab-controls');
form.addEventListener('submit',event=>event.preventDefault());
for(const control of controls){
  const label=element('label','lab-control'),name=element('span','lab-control-name',control.label);
  const output=element('output','lab-control-value',control.show(state[control.key]));
  const input=element('input');
  Object.assign(input,{type:'range',min:control.min,max:control.max,step:control.step,value:state[control.key]});
  input.addEventListener('input',()=>{state[control.key]=Number(input.value);output.textContent=control.show(state[control.key]);schedule();});
  name.append(output);label.append(name,input);form.append(label);
}
const frequencyLabel=element('label','lab-control');
frequencyLabel.append(element('span','lab-control-name','Hedging frequency'));
const frequency=element('select');
for(const [value,name] of frequencies){
  const option=element('option','',name);
  option.value=value;option.selected=value===state.hedgesPerYear;frequency.append(option);
}
frequency.addEventListener('change',()=>{state.hedgesPerYear=Number(frequency.value);schedule();});
frequencyLabel.append(frequency);
form.append(frequencyLabel);

const stats=element('dl','lab-stats');
const reading=element('p','lab-reading');
reading.setAttribute('role','status');
const pnlChart=element('div'),scatterChart=element('div');
root.replaceChildren(form,stats,reading,
  element('h3','lab-heading','P&L across simulated paths'),pnlChart,
  element('h3','lab-heading','What explains each path'),scatterChart);

function setStats(items) {
  stats.replaceChildren(...items.flatMap(([term,value])=>[element('dt','',term),element('dd','',value)]));
}
function run() {
  const result=simulate({...state,spot:100,strike:100,rate:0,paths:4000});
  const pnl=result.results.map(path=>path.pnl);
  const sign=value=>`${value>=0?'+':''}${value.toFixed(2)}`;
  setStats([
    ['Premium paid',result.start.price.toFixed(2)],
    ['Average P&L',sign(result.meanPnl)],
    ['Vega estimate',sign(result.vegaEstimate)],
    ['Standard deviation',result.sdPnl.toFixed(2)],
    ['Paths that lose money',`${(result.lossShare*100).toFixed(1)}%`],
    ['Average hedging cost',result.meanCost.toFixed(2)]
  ]);
  reading.textContent=`Gamma-weighted variance explains ${(result.r2GammaWeighted*100).toFixed(0)}% of the variation between paths. Plain realized variance explains ${(result.r2RealizedVol*100).toFixed(0)}%. Hedging ${result.steps} times, the discrete hedging approximation predicts a standard deviation of ${result.discreteHedgeEstimate.toFixed(2)} when realized equals implied.`;
  chart(pnlChart,{
    title:'Distribution of hedged P&L',description:'Histogram of the final P&L of the hedged option across all simulated paths.',
    xLabel:'Final P&L per option',yLabel:'Share of paths',marker:{x:result.meanPnl,label:'average'},
    series:[{kind:'bars',points:histogram(pnl)}]
  });
  const sample=result.results.slice(0,900);
  chart(scatterChart,{
    title:'P&L against gamma-weighted variance',description:'Each dot is one path. Paths line up against the gamma-weighted measure.',
    xLabel:'Sum of ½ × gamma × S² × (return² − implied variance × dt)',yLabel:'Final P&L',
    series:[{kind:'dots',points:sample.map(path=>({x:path.gammaVariance,y:path.pnl}))}]
  });
}
let timer=null;
function schedule() {
  clearTimeout(timer);
  timer=setTimeout(run,120);
}
schedule();
