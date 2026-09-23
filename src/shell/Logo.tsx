/**
 * The Cruise logo: an open arc with a dot at the gap, and the wordmark.
 * The arc takes currentColor so it sits on any plate; the dot is the one
 * accent, --logo-accent. The wordmark is Space Grotesk Bold outlined to a
 * path so no extra font ships. Source: the "Cruise app logo" board.
 */
const ARC = 'M 386.2 365.3 A 170 170 0 1 1 386.2 146.7';
const CRUISE =
  'M332 14Q202 14 126.0 -58.5Q50 -131 50 -266V-434Q50 -569 126.0 -641.5Q202 -714 332 -714Q461 -714 531.5 -643.5Q602 -573 602 -450V-444H472V-454Q472 -516 437.5 -556.0Q403 -596 332 -596Q262 -596 222.0 -553.0Q182 -510 182 -436V-264Q182 -191 222.0 -147.5Q262 -104 332 -104Q403 -104 437.5 -144.5Q472 -185 472 -246V-264H602V-250Q602 -127 531.5 -56.5Q461 14 332 14ZM694.0 0V-496H818.0V-440H836.0Q847.0 -470 872.5 -484.0Q898.0 -498 932.0 -498H992.0V-386H930.0Q882.0 -386 851.0 -360.5Q820.0 -335 820.0 -282V0ZM1259.0 8Q1201.0 8 1157.5 -18.5Q1114.0 -45 1090.0 -92.0Q1066.0 -139 1066.0 -200V-496H1192.0V-210Q1192.0 -154 1219.5 -126.0Q1247.0 -98 1298.0 -98Q1356.0 -98 1388.0 -136.5Q1420.0 -175 1420.0 -244V-496H1546.0V0H1422.0V-65H1404.0Q1392.0 -40 1359.0 -16.0Q1326.0 8 1259.0 8ZM1666.0 0V-496H1792.0V0ZM1729.0 -554Q1695.0 -554 1671.5 -576.0Q1648.0 -598 1648.0 -634Q1648.0 -670 1671.5 -692.0Q1695.0 -714 1729.0 -714Q1764.0 -714 1787.0 -692.0Q1810.0 -670 1810.0 -634Q1810.0 -598 1787.0 -576.0Q1764.0 -554 1729.0 -554ZM2118.0 14Q2021.0 14 1959.0 -28.0Q1897.0 -70 1884.0 -148L2000.0 -178Q2007.0 -143 2023.5 -123.0Q2040.0 -103 2064.5 -94.5Q2089.0 -86 2118.0 -86Q2162.0 -86 2183.0 -101.5Q2204.0 -117 2204.0 -140Q2204.0 -163 2184.0 -175.5Q2164.0 -188 2120.0 -196L2092.0 -201Q2040.0 -211 1997.0 -228.5Q1954.0 -246 1928.0 -277.0Q1902.0 -308 1902.0 -357Q1902.0 -431 1956.0 -470.5Q2010.0 -510 2098.0 -510Q2181.0 -510 2236.0 -473.0Q2291.0 -436 2308.0 -376L2191.0 -340Q2183.0 -378 2158.5 -394.0Q2134.0 -410 2098.0 -410Q2062.0 -410 2043.0 -397.5Q2024.0 -385 2024.0 -363Q2024.0 -339 2044.0 -327.5Q2064.0 -316 2098.0 -310L2126.0 -305Q2182.0 -295 2227.5 -278.5Q2273.0 -262 2299.5 -231.5Q2326.0 -201 2326.0 -149Q2326.0 -71 2269.5 -28.5Q2213.0 14 2118.0 14ZM2642.0 14Q2568.0 14 2511.5 -17.5Q2455.0 -49 2423.5 -106.5Q2392.0 -164 2392.0 -242V-254Q2392.0 -332 2423.0 -389.5Q2454.0 -447 2510.0 -478.5Q2566.0 -510 2640.0 -510Q2713.0 -510 2767.0 -477.5Q2821.0 -445 2851.0 -387.5Q2881.0 -330 2881.0 -254V-211H2520.0Q2522.0 -160 2558.0 -128.0Q2594.0 -96 2646.0 -96Q2699.0 -96 2724.0 -119.0Q2749.0 -142 2762.0 -170L2865.0 -116Q2851.0 -90 2824.5 -59.5Q2798.0 -29 2754.0 -7.5Q2710.0 14 2642.0 14ZM2521.0 -305H2753.0Q2749.0 -348 2718.5 -374.0Q2688.0 -400 2639.0 -400Q2588.0 -400 2558.0 -374.0Q2528.0 -348 2521.0 -305Z';

/** Mark only: the arc and dot in a square. */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d={ARC} fill="none" stroke="currentColor" strokeWidth="60" strokeLinecap="round" />
      <circle className="logo__dot" cx="418" cy="256" r="32" />
    </svg>
  );
}

/** Mark and wordmark on one line, 452:120; size it by height. */
export function Logo({ className, height = 28 }: { className?: string; height?: number }) {
  return (
    <svg className={className} height={height} width={(height * 452) / 120} viewBox="0 0 452 120" role="img" aria-label="Cruise" focusable="false">
      <g transform="scale(0.234375)">
        <path d={ARC} fill="none" stroke="currentColor" strokeWidth="60" strokeLinecap="round" />
        <circle className="logo__dot" cx="418" cy="256" r="32" />
      </g>
      <path d={CRUISE} fill="currentColor" transform="translate(148 96.4) scale(0.104)" />
    </svg>
  );
}
