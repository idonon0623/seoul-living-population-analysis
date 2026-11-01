"""Rebuild Assignment 3 outputs from committed, non-personal public-data inputs.

python scripts/assignment3/build_analysis.py
Optional one-time import: --import-course PATH_TO_COURSE_ROOT
Optional original processed-row audit: --audit-raw PATH_TO_SPOP_2025_ADM.csv
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / 'data' / 'assignment3'
OUT = ROOT / 'public' / 'data'
DAY = list(range(9, 18))
NIGHT = list(range(0, 6))


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def save_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--import-course', type=Path)
    parser.add_argument('--audit-raw', type=Path)
    args = parser.parse_args()
    INPUT.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if args.import_course:
        src = args.import_course / 'lecture06_Living_Population' / 'data'
        shutil.copyfile(src / 'SPOP_2025_ADM_mid.csv', INPUT / 'hourly_mean_2025.csv')
        boundary = gpd.read_file(src / 'HangJeongDong_ver20250101.geojson')
        boundary = boundary.loc[boundary['sido'] == '11'].copy()
        boundary.to_file(INPUT / 'seoul_dong_20250101.geojson', driver='GeoJSON')
        save_json(INPUT / 'source_manifest.json', {
            'population_original': 'lecture06_Living_Population/data/SPOP_2025_ADM_mid.csv',
            'population_original_sha256': sha(src / 'SPOP_2025_ADM_mid.csv'),
            'boundary_original': 'lecture06_Living_Population/data/HangJeongDong_ver20250101.geojson',
            'boundary_original_sha256': sha(src / 'HangJeongDong_ver20250101.geojson'),
            'boundary_extraction': "sido == '11'; coordinates preserved, no simplification in input",
            'population_provider': '서울특별시 열린데이터광장',
            'population_dataset_url': 'https://data.seoul.go.kr/dataList/OA-23016/S/1/datasetView.do',
            'population_dataset': '[내국인] 행정동별 서울 생활인구(250m)',
            'months': [f'2025{m:02}' for m in range(1, 13)],
            'upstream_preparation': 'Course notebook 01_living_population_data_preparation.ipynb downloads 12 monthly OA-23016 ZIP files; merges codes 11230515,11230533,11230536 into 11230536 by date/hour. Notebook 02_living_population_time_series_visualization.ipynb computes the arithmetic mean over all dates for each dong/hour.',
            'boundary_provenance_limit': 'Boundary supplied in the course folder, filename dated 2025-01-01. Original external provider and license were not established from the supplied file; this is not asserted to be an official cadastral boundary.'
        })
    df = pd.read_csv(INPUT / 'hourly_mean_2025.csv', dtype={'ADMI_CD': str})
    df['TT_str'] = df['TT_str'].astype(int)
    assert len(df) == 426 * 24 and not df.duplicated(['ADMI_CD', 'TT_str']).any()
    assert not df[['ADMI_CD', 'TT_str', 'SPOP_mid']].isna().any().any()
    assert (df['SPOP_mid'] >= 0).all() and set(df.TT_str) == set(range(24))
    wide = df.pivot(index='ADMI_CD', columns='TT_str', values='SPOP_mid').sort_index()
    assert wide.shape == (426, 24) and wide.notna().all().all()
    boundary = gpd.read_file(INPUT / 'seoul_dong_20250101.geojson')
    boundary['code'] = boundary.adm_cd2.str[:8]
    assert boundary.code.is_unique and set(boundary.code) == set(wide.index)
    boundary = boundary.set_index('code').loc[wide.index]
    projected = boundary.to_crs(5179)
    areas = projected.area / 1e6
    assert (areas > 0).all() and boundary.is_valid.all()
    city_hourly = wide.sum(axis=0)
    city_day_share = float(city_hourly.loc[DAY].sum() / city_hourly.sum())
    names = df.drop_duplicates('ADMI_CD').set_index('ADMI_CD')
    rows = []
    for code, series in wide.iterrows():
        day = float(series.loc[DAY].mean())
        night = float(series.loc[NIGHT].mean())
        weights = series / series.sum()
        r = {
            'code': code, 'district': names.loc[code, 'SGG_NM'], 'name': names.loc[code, 'ADMI_NM'],
            'area_km2': float(areas.loc[code]), 'hourly': [float(x) for x in series],
            'day_population': day, 'night_population': night, 'mean_population': float(series.mean()),
            'day_density': day / float(areas.loc[code]),
            'day_lq': float(series.loc[DAY].sum() / series.sum() / city_day_share),
            'day_night_ratio': day / night,
            'temporal_entropy': float(-(weights[weights > 0] * np.log(weights[weights > 0])).sum() / math.log(24))
        }
        rows.append(r)
    table = pd.DataFrame(rows).drop(columns='hourly')
    # Full-precision CSV prevents display rounding from changing subsequent analyses.
    table.to_csv(OUT / 'indicators.csv', index=False, encoding='utf-8-sig')
    audit = {'aggregate_rows': len(df), 'dong_count': len(wide), 'hours_per_dong': 24,
             'geometry_matches': len(boundary), 'geometry_missing': 0, 'duplicates': 0,
             'missing_values': 0, 'area_crs': 'EPSG:5179', 'input_sha256': {
                 f: sha(INPUT / f) for f in ['hourly_mean_2025.csv', 'seoul_dong_20250101.geojson']}}
    if args.audit_raw:
        raw = pd.read_csv(args.audit_raw, usecols=['YMD', 'TT', 'ADMI_CD', 'SPOP'], dtype={'ADMI_CD': str})
        assert len(raw) == 365 * 426 * 24
        assert raw.YMD.nunique() == 365 and not raw.duplicated(['YMD', 'TT', 'ADMI_CD']).any()
        assert not raw.isna().any().any() and (raw.SPOP >= 0).all()
        assert (raw.groupby(['ADMI_CD', 'TT']).size() == 365).all()
        recomputed = raw.groupby(['ADMI_CD', 'TT']).SPOP.mean().unstack()
        max_diff = float((recomputed - wide).abs().max().max())
        assert max_diff < 1e-7
        audit.update({'raw_processed_rows': len(raw), 'raw_dates': 365,
                      'raw_start': int(raw.YMD.min()), 'raw_end': int(raw.YMD.max()),
                      'raw_duplicates': 0, 'raw_missing_values': 0,
                      'raw_means_max_absolute_difference': max_diff,
                      'raw_sha256': sha(args.audit_raw)})
        save_json(INPUT / 'raw_audit.json', audit)
    if (INPUT / 'raw_audit.json').exists():
        audit['previous_raw_audit'] = json.loads((INPUT / 'raw_audit.json').read_text(encoding='utf-8'))
    shutil.copyfile(INPUT / 'source_manifest.json', OUT / 'source_manifest.json')
    ordered = lambda metric, asc=False: table.sort_values(metric, ascending=asc).head(8).to_dict('records')
    med_density = float(table.day_density.median())
    summary = {
        'density_top': ordered('day_density'), 'density_bottom': ordered('day_density', True),
        'lq_top': ordered('day_lq'), 'lq_bottom': ordered('day_lq', True),
        'density_lq_pearson': float(table.day_density.corr(table.day_lq)),
        'density_lq_spearman': float(table.day_density.rank().corr(table.day_lq.rank())),
        'median_density': med_density,
        'lq_above_1_count': int((table.day_lq > 1).sum()),
        'quadrants': {
            'high_density_high_lq': int(((table.day_density >= med_density) & (table.day_lq >= 1)).sum()),
            'high_density_low_lq': int(((table.day_density >= med_density) & (table.day_lq < 1)).sum()),
            'low_density_high_lq': int(((table.day_density < med_density) & (table.day_lq >= 1)).sum()),
            'low_density_low_lq': int(((table.day_density < med_density) & (table.day_lq < 1)).sum())},
    }
    district_rows = []
    for district, sub in table.groupby('district'):
        h = wide.loc[sub.code].sum(axis=0)
        area = float(sub.area_km2.sum())
        district_rows.append({'district': district, 'dong_count': len(sub), 'area_km2': area,
                             'day_population': float(h.loc[DAY].mean()),
                             'day_density': float(h.loc[DAY].mean()) / area,
                             'day_lq': float(h.loc[DAY].sum() / h.sum() / city_day_share)})
    metadata = {'title': '낮에 모이는 서울, 밀도와 특화는 같은가?', 'year': 2025,
                'day_hours': DAY, 'night_hours': NIGHT, 'population_scope': '내국인 생활인구',
                'temporal_scope': '2025년 365일 전체(평일·주말·공휴일 포함)의 시간대별 산술평균',
                'spatial_scope': '2025-01-01 경계에 맞춘 서울 426개 행정동',
                'source': json.loads((INPUT / 'source_manifest.json').read_text(encoding='utf-8')),
                'validation': audit}
    result = {'metadata': metadata, 'city': {'hourly': list(city_hourly), 'day_population': float(city_hourly.loc[DAY].mean()),
                'night_population': float(city_hourly.loc[NIGHT].mean()), 'day_share': city_day_share,
                'area_km2': float(areas.sum()), 'day_density': float(city_hourly.loc[DAY].mean()/areas.sum())},
                'rows': rows, 'districts': district_rows, 'summary': summary}
    save_json(OUT / 'analysis.json', result)
    # Area is always measured from the unsimplified source. Simplification is display-only.
    display = gpd.GeoDataFrame({'code': boundary.index,
         'district': [names.loc[c, 'SGG_NM'] for c in boundary.index],
         'name': [names.loc[c, 'ADMI_NM'] for c in boundary.index]},
         geometry=list(projected.geometry.simplify(10, preserve_topology=True)), crs=5179).to_crs(4326)
    geometry = json.loads(display.to_json(drop_id=True))
    save_json(OUT / 'geometry.geojson', geometry)
    save_json(OUT / 'validation.json', audit)
    print(json.dumps({'rows': len(rows), 'summary': summary, 'city': result['city'], 'outputs': str(OUT)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
