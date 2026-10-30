import test from 'node:test';
import assert from 'node:assert/strict';
import {cdf,createRandom,greeks,hedgePath,histogram,rSquared,simulate} from '../src/model.mjs';

const close=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not within ${tolerance} of ${expected}`);
const option={spot:100,strike:100,rate:0.05,vol:0.2,time:1};

test('cumulative normal matches known values',()=>{
  close(cdf(0),0.5,1e-12);
  close(cdf(1.96),0.9750021048517795,1e-12);
  close(cdf(-1.96),1-cdf(1.96),1e-12);
  close(cdf(8),1-6.22096e-16,1e-14);
});

test('Black-Scholes reproduces the reference call',()=>close(greeks(option).price,10.4506,5e-5));

test('put-call parity holds through the call price',()=>{
  const call=greeks(option).price,put=call-100+100*Math.exp(-0.05);
  close(put,5.5735,5e-5);
});

test('Greeks agree with central differences',()=>{
  const base=greeks({...option,time:0.25}),bump=0.01;
  const at=change=>greeks({...option,time:0.25,...change}).price;
  close(base.delta,(at({spot:100+bump})-at({spot:100-bump}))/(2*bump),1e-6);
  close(base.gamma,(at({spot:100+bump})-2*at({})+at({spot:100-bump}))/(bump*bump),1e-4);
  close(base.vega,(at({vol:0.2+1e-4})-at({vol:0.2-1e-4}))/2e-4,1e-5);
  close(base.theta,-(at({time:0.25+1e-5})-at({time:0.25-1e-5}))/2e-5,1e-4);
});

test('the normal generator is reproducible and looks standard',()=>{
  const first=createRandom(5),second=createRandom(5);
  assert.deepEqual([first(),first(),first()],[second(),second(),second()]);
  const draw=createRandom(1),values=Array.from({length:50000},draw);
  const mean=values.reduce((a,b)=>a+b)/values.length,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
  close(mean,0,0.02);close(variance,1,0.03);
});

test('a path with no moves earns minus the option premium plus the delta effect',()=>{
  const settings={spot:100,strike:100,rate:0,time:0.25,impliedVol:0.2,costBps:0};
  const result=hedgePath(settings,new Array(63).fill(0));
  close(result.pnl,-greeks({spot:100,strike:100,rate:0,vol:0.2,time:0.25}).price,1e-9);
});

test('average hedged P&L follows the volatility difference, not the direction',()=>{
  const above=simulate({realizedVol:0.25,paths:20000}),equal=simulate({realizedVol:0.2,paths:20000}),below=simulate({realizedVol:0.15,paths:20000});
  close(above.meanPnl,above.vegaEstimate,3*above.standardError+0.03);
  close(equal.meanPnl,0,3*equal.standardError);
  close(below.meanPnl,below.vegaEstimate,3*below.standardError+0.03);
});

test('discrete hedging noise falls with the square root of the number of hedges',()=>{
  const daily=simulate({realizedVol:0.2,hedgesPerYear:252,paths:6000});
  const four=simulate({realizedVol:0.2,hedgesPerYear:1008,paths:6000});
  close(daily.sdPnl/four.sdPnl,2,0.15);
  close(daily.sdPnl/daily.discreteHedgeEstimate,1,0.1);
});

test('transaction costs reduce the average result by what was paid',()=>{
  const free=simulate({costBps:0,paths:2000}),paying=simulate({costBps:5,paths:2000});
  close(free.meanPnl-paying.meanPnl,paying.meanCost,1e-9);
  assert.ok(paying.meanCost>0);
});

test('gamma-weighted variance explains P&L better than plain realized variance',()=>{
  const result=simulate({realizedVol:0.3,hedgesPerYear:252,paths:6000});
  assert.ok(result.r2GammaWeighted>result.r2RealizedVol);
  assert.ok(result.r2GammaWeighted>0.8);
});

test('the histogram keeps every observation',()=>{
  const bins=histogram([1,2,2,3,3,3,4],5);
  close(bins.reduce((sum,bin)=>sum+bin.y,0),1,1e-12);
});

test('r squared is one for a perfect line and zero for no relation',()=>{
  close(rSquared([1,2,3],[2,4,6]),1,1e-12);
  close(rSquared([1,2,3,4],[1,-1,-1,1]),0,1e-12);
});
