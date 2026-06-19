# MOE NN Calculator

Static web calculator for RNA/RNA, RNA/DNA, RRHD-MOE/RNA, ALT-MOE/RNA, and mixed gapmer duplexes.

## Online notation

- `Am` = 2′-MOE-A
- `Cm` = 2′-MOE-C
- `Gm` = 2′-MOE-G
- `Um` = 2′-MOE-U
- `dA`, `dC`, `dG`, `dT` = DNA residues
- `A`, `C`, `G`, `U` = RNA residues

Legacy H/J/K/L notation is also accepted internally:

- H = Am
- J = Cm
- K = Gm
- L = Um

## Parameter sets

- RRHD: one strand is fully 2′-MOE modified and hybridized with RNA.
- ALT: one strand contains partial/intermittent 2′-MOE modifications and is hybridized with RNA.
- DNA/RNA: DNA strand hybridized with RNA.
- RNA/RNA: unmodified RNA duplex.
- Gapmer: terminal MOE wings and central DNA gap. MOE/MOE regions are calculated using RRHD parameters, DNA/RNA regions using DNA/RNA hybrid parameters, and MOE-DNA junctions using ALT-based approximation.

## Conditions

Non-crowding condition: 100 mM NaCl, 10 mM Na2HPO4 (pH 7.0 at 37 °C), 1 mM Na2EDTA.

Cell-like condition: 40 wt% PEG200, 100 mM NaCl, 10 mM Na2HPO4 (pH 7.0 at 37 °C), 1 mM Na2EDTA.

## Limitation

The current version is parameterized for phosphodiester (P=O) backbones. Phosphorothioate (P=S) backbones are currently approximated using P=O parameters.


V6.8: Fixed compact DNA parameter-key parsing so internal keys such as dTT do not trigger the single-letter T warning, while user input such as dCGm is still parsed as dC + Gm.
