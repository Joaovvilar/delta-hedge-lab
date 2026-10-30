// Delta hedging a call in a Black-Scholes world. The option is bought at an
// implied volatility, hedged at that same volatility, and the underlying then
// moves with a different realized volatility. The question is what the hedged
// position earns, and how much of the result is noise.

const SQRT_TWO_PI=Math.sqrt(2*Math.PI);
export const density=x=>Math.exp(-x*x/2)/SQRT_TWO_PI;

// Cumulative normal, West (2005) double precision version of Hart's algorithm.
export function cdf(x) {
  const y=Math.abs(x);
  let c;
  if(y>37)c=0;
  else {
    const e=Math.exp(-y*y/2);
    if(y<7.07106781186547){
      let a=3.52624965998911e-2*y+0.700383064443688;
      a=a*y+6.37396220353165;a=a*y+33.912866078383;a=a*y+112.079291497871;a=a*y+221.213596169931;a=a*y+220.206867912376;
      let b=8.83883476483184e-2*y+1.75566716318264;
      b=b*y+16.064177579207;b=b*y+86.7807322029461;b=b*y+296.564248779674;b=b*y+637.333633378831;b=b*y+793.826512519948;b=b*y+440.413735824752;
      c=e*a/b;
    } else {
      let b=y+0.65;b=y+4/b;b=y+3/b;b=y+2/b;b=y+1/b;
      c=e/b/2.506628274631;
    }
  }
  return x>0?1-c:c;
}

export function greeks({spot,strike,rate=0,vol,time}) {
  if(time<=0){
    const inMoney=spot>strike;
    return {price:Math.max(spot-strike,0),delta:inMoney?1:0,gamma:0,vega:0,theta:0};
  }
  const root=Math.sqrt(time),d1=(Math.log(spot/strike)+(rate+vol*vol/2)*time)/(vol*root),d2=d1-vol*root;
  const discount=Math.exp(-rate*time),pdf=density(d1);
  return {
    price:spot*cdf(d1)-strike*discount*cdf(d2),
    delta:cdf(d1),
    gamma:pdf/(spot*vol*root),
    vega:spot*pdf*root,
    theta:-spot*pdf*vol/(2*root)-rate*strike*discount*cdf(d2)
  };
}

export function createRandom(seed) {
  let state=seed>>>0,spare=null;
  const uniform=()=>{
    state=(state+0x6D2B79F5)>>>0;
    let mixed=Math.imul(state^(state>>>15),1|state);
    mixed^=mixed+Math.imul(mixed^(mixed>>>7),61|mixed);
    return ((mixed^(mixed>>>14))>>>0)/4294967296;
  };
  return ()=>{
    if(spare!==null){const value=spare;spare=null;return value;}
    let u,v,s;
    do{u=2*uniform()-1;v=2*uniform()-1;s=u*u+v*v;}while(s===0||s>=1);
    const factor=Math.sqrt(-2*Math.log(s)/s);
    spare=v*factor;return u*factor;
  };
}

export const DEFAULTS=Object.freeze({spot:100,strike:100,rate:0,time:0.25,impliedVol:0.2,realizedVol:0.25,hedgesPerYear:252,costBps:0,paths:4000,seed:11});

// One hedged path. `returns` are log returns, one per hedging step.
export function hedgePath(options,returns) {
  const {spot,strike,rate,time,impliedVol,costBps}=options;
  const steps=returns.length,dt=time/steps,costRate=costBps/10000;
  const start=greeks({spot,strike,rate,vol:impliedVol,time});
  let price=spot,position=start.delta;
  let cash=-start.price+position*price-Math.abs(position)*price*costRate,costs=Math.abs(position)*price*costRate;
  let gammaVariance=0,sumSquares=0,previous=start;
  for(let step=1;step<=steps;step++){
    cash*=Math.exp(rate*dt);
    const move=returns[step-1],next=price*Math.exp(move);
    // Dollar gamma weights each squared return, using the gamma held over the step.
    gammaVariance+=0.5*previous.gamma*price*price*(move*move-impliedVol*impliedVol*dt);
    sumSquares+=move*move;
    price=next;
    const remaining=time-step*dt;
    if(step<steps){
      const current=greeks({spot:price,strike,rate,vol:impliedVol,time:remaining});
      const trade=current.delta-position,cost=Math.abs(trade)*price*costRate;
      cash+=trade*price-cost;costs+=cost;position=current.delta;previous=current;
    }
  }
  const finalCost=Math.abs(position)*price*costRate;
  costs+=finalCost;
  const pnl=Math.max(price-strike,0)-position*price+cash-finalCost;
  return {pnl,costs,gammaVariance,realizedVol:Math.sqrt(sumSquares/time),finalPrice:price};
}

function stats(values) {
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  const variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1);
  return {mean,sd:Math.sqrt(variance)};
}

export function rSquared(xs,ys) {
  const mx=stats(xs).mean,my=stats(ys).mean;
  let sxy=0,sxx=0,syy=0;
  for(let index=0;index<xs.length;index++){
    sxy+=(xs[index]-mx)*(ys[index]-my);sxx+=(xs[index]-mx)**2;syy+=(ys[index]-my)**2;
  }
  return sxx&&syy?sxy*sxy/(sxx*syy):0;
}

export function simulate(options={}) {
  const config={...DEFAULTS,...options};
  const {spot,strike,rate,time,impliedVol,realizedVol,hedgesPerYear,paths,seed}=config;
  const steps=Math.max(1,Math.round(hedgesPerYear*time)),dt=time/steps,normal=createRandom(seed);
  const drift=(rate-realizedVol*realizedVol/2)*dt,scale=realizedVol*Math.sqrt(dt);
  const results=new Array(paths);
  for(let path=0;path<paths;path++){
    const returns=new Array(steps);
    for(let step=0;step<steps;step++)returns[step]=drift+scale*normal();
    results[path]=hedgePath(config,returns);
  }
  const start=greeks({spot,strike,rate,vol:impliedVol,time});
  const pnl=results.map(result=>result.pnl),summary=stats(pnl);
  return {
    config,steps,start,results,
    meanPnl:summary.mean,sdPnl:summary.sd,
    standardError:summary.sd/Math.sqrt(paths),
    lossShare:pnl.filter(value=>value<0).length/paths,
    meanCost:stats(results.map(result=>result.costs)).mean,
    // First-order result from the difference between the two volatilities.
    vegaEstimate:start.vega*(realizedVol-impliedVol),
    // Derman and Kamal's approximation for the error from discrete hedging.
    discreteHedgeEstimate:Math.sqrt(Math.PI/4)*start.vega*impliedVol/Math.sqrt(steps),
    // How much of the path-to-path variation each explanation accounts for.
    r2RealizedVol:rSquared(results.map(result=>result.realizedVol**2),pnl),
    r2GammaWeighted:rSquared(results.map(result=>result.gammaVariance),pnl)
  };
}

export function histogram(values,bins=36) {
  const low=Math.min(...values),high=Math.max(...values),width=(high-low||1)/bins;
  const counts=new Array(bins).fill(0);
  for(const value of values)counts[Math.min(bins-1,Math.floor((value-low)/width))]++;
  return counts.map((count,index)=>({x0:low+index*width,x1:low+(index+1)*width,y:count/values.length}));
}
