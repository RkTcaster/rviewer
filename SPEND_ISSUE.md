# `spend_*` en `table_round_situations` no es el valor del equipamiento

## El problema

En `table_round_situations.csv`, las columnas `spend_start`, `spend_alive` y `spend_rival_alive` cuentan lo que se
**compró en esa ronda**. No incluyen las armas que el equipo traía de la ronda anterior, ya sea porque guardó o porque
ganó con sobrevivientes. Cada arma traída baja el valor unos 3k, así que un equipo que arranca con 5 primarias puede
figurar con menos de 5k.

Con 5 primarias al arranque (Vandal + Phantom + Operator), según cuántas trajo de la ronda anterior:

| Primarias traídas | Rondas | `spend_start` (mediana) | `team_*_economy` de vlr (mediana) |
|---|---|---|---|
| 0 | 9,091 | 20,800 | 22,200 |
| 1 | 2,256 | 17,500 | 23,400 |
| 2 | 3,052 | 14,600 | 23,750 |
| 3 | 3,240 | 11,400 | 23,900 |
| 4 | 2,580 | 8,075 | 24,000 |
| 5 | 984 | 4,700 | 24,000 |

## Qué tablas están bien y cuál no

- **`table_team_economy.csv` (vlr) está bien.** `team_a_economy` / `team_b_economy` incluyen lo traído, porque el valor
  se mantiene en ~24k sin importar cuántas armas se guardaron. Con sus cortes (eco < 5k, etc.) ninguna ronda "eco"
  tiene 3 o más primarias.
- **`table_round_situations.csv` (la tabla derivada) es la que falla:**
  - `spend_start` coincide con el valor de vlr en solo el **1.2%** de las filas al inicio de la ronda. La diferencia
    mediana es 1.9k y el rango va de −7.5k a +25k. En el 6.3% de las filas `spend_start` incluso supera a vlr.
  - `spend_alive` y `spend_rival_alive` tienen la misma lógica: cuentan solo lo comprado por los jugadores vivos.
  - `bank_start` está bien: difiere de `team_*_bank` en 100 o menos, por redondeo.
- **`table_situation_stats.csv`** no tiene columnas de gasto, así que no se ve afectada.

## Dónde pegaba en este repo

- **`situations_eda.ipynb`, sección 7:** clasificaba las compras con cortes de `spend_start` (eco < 5k, semi-eco 5–10k,
  semi-buy 10–17.5k, full ≥ 17.5k). El 22% de las rondas "eco" y el 52% de las "semi-eco" arrancaban con 3 o más
  primarias, así que el cruce de compras estaba mal etiquetado. Ya está corregido: las categorías salen de las primarias
  que tiene el equipo.
- **Gráfico de diferencia de gasto (también sección 7):** mide diferencia de *compras* entre los jugadores vivos, no de
  equipamiento. Solo cambié la etiqueta.
- **`map_result_glm.ipynb`:** usa `table_team_economy` (`eco_wr`, `antieco_wr`), así que no le afecta.

## Qué revisar en el otro repo

1. Cómo se calcula `spend_*` en el pipeline que arma `table_round_situations`. Parece sumar solo las compras de la
   ronda; habría que sumar el valor de lo traído o tomar el de vlr.
2. Por qué hay filas con `spend_start` mayor que el valor de vlr. Puede que esté contando habilidades u otra cosa que
   vlr no cuenta.
3. Si conviene renombrar las columnas (`buy_*` en vez de `spend_*`) o agregar una columna de equipamiento total.

## Chequeo para reproducirlo

```python
import pandas as pd

rs = pd.read_csv("tables/table_round_situations.csv")
e = pd.read_csv("tables/table_team_economy.csv")
cols = ["team_map_round_id", "team", "eco", "bank"]
ee = pd.concat([e[["team_map_round_id", "team_a", "team_a_economy", "team_a_bank"]].set_axis(cols, axis=1),
                e[["team_map_round_id", "team_b", "team_b_economy", "team_b_bank"]].set_axis(cols, axis=1)])
j = rs[rs.seg_index == 0].merge(ee, on=["team_map_round_id", "team"])
print((j.spend_start == j.eco).mean())               # 0.012
print((j.bank_start - j.bank).abs().le(100).mean())  # 1.0
```
