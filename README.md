# Delta hedge lab

A Monte Carlo study of what a delta-hedged option earns. It separates the part of the result that comes from the volatility view from the part that is noise.

Live version: https://jvvilar.com/projects/delta-hedge-lab/

## What it does

- Buys a European call at an implied volatility and hedges at that same volatility.
- Simulates the underlying at a different realized volatility, with a chosen hedging frequency and transaction cost.
- Compares the simulated average with the first-order estimate, `vega × (realized − implied)`.
- Compares the noise with the Derman-Kamal approximation for discrete hedging, `√(π/4) × vega × σ / √N`.
- Measures how much of the variation between paths each explanation accounts for: plain realized variance against gamma-weighted variance.

## Results with the default option

Three-month at-the-money call, spot 100, 20% implied, daily hedges, 20,000 paths:

| Realized | Average P&L | Vega estimate | Std dev | Losing paths | R² realized | R² gamma-weighted |
|---|---|---|---|---|---|---|
| 15% | −1.00 | −1.00 | 0.46 | 99.7% | 0.35 | 0.98 |
| 20% | 0.00 | 0.00 | 0.44 | 50.6% | 0.67 | 0.97 |
| 25% | +0.99 | +1.00 | 0.68 | 2.3% | 0.41 | 0.97 |

The tests check these relationships, as well as the Greeks against finite differences and the square-root behaviour of hedging noise.

## Run it

Needs Node.js 22 or later and has no dependencies.

```bash
npm test
```

## Limits

Volatility is constant within a path, returns are lognormal, rates are flat and the hedge uses the implied volatility. There are no jumps, no skew and no stochastic volatility. Real books have all of these.

This is a personal learning project. It uses no data from any employer, and it is not investment advice.
