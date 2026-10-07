# ELW 현재가 시세

- 메뉴: [국내주식] ELW 시세
- API ID: `v1_국내주식-014` · 통신방식: REST
- 요청: `GET /uapi/domestic-stock/v1/quotations/inquire-elw-price`
- TR_ID: 실전 `FHKEW15010000` · 모의 `FHKEW15010000`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 https://openapivts.koreainvestment.com:29443

## 개요

ELW 현재가 시세 API입니다. ELW 관련 정보를 얻을 수 있습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKEW15010000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건 시장 분류 코드 | string | Y | 2 | W |
| FID_INPUT_ISCD | 입력 종목코드 | string | Y | 12 | 종목번호 (6자리) |

## Response Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | 요청한 tr_id |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| rt_cd | 성공 실패 여부 | string | Y | 1 |  |
| msg_cd | 응답코드 | string | Y | 8 |  |
| msg1 | 응답메세지 | string | Y | 80 |  |
| **output1** | 응답상세 | object array | Y |  | array |
| elw_shrn_iscd | ELW 단축 종목코드 | string | Y | 9 |  |
| hts_kor_isnm | HTS 한글 종목명 | string | Y | 40 |  |
| elw_prpr | ELW 현재가 | string | Y | 10 |  |
| prdy_vrss | 전일 대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 1 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 11 |  |
| acml_vol | 누적 거래량 | string | Y | 18 |  |
| prdy_vrss_vol_rate | 전일 대비 거래량 비율 | string | Y | 13 |  |
| unas_shrn_iscd | 기초자산 단축 종목코드 | string | Y | 9 |  |
| unas_isnm | 기초자산 종목명 | string | Y | 40 |  |
| unas_prpr | 기초자산 현재가 | string | Y | 14 |  |
| unas_prdy_vrss | 기초자산 전일 대비 | string | Y | 14 |  |
| unas_prdy_vrss_sign | 기초자산 전일 대비 부호 | string | Y | 1 |  |
| unas_prdy_ctrt | 기초자산 전일 대비율 | string | Y | 11 |  |
| bidp | 매수호가 | string | Y | 10 |  |
| askp | 매도호가 | string | Y | 10 |  |
| acml_tr_pbmn | 누적 거래 대금 | string | Y | 18 |  |
| vol_tnrt | 거래량 회전율 | string | Y | 11 |  |
| elw_oprc | ELW 시가2 | string | Y | 10 |  |
| elw_hgpr | ELW 최고가 | string | Y | 10 |  |
| elw_lwpr | ELW 최저가 | string | Y | 10 |  |
| stck_prdy_clpr | 주식 전일 종가 | string | Y | 10 |  |
| hts_thpr | HTS 이론가 | string | Y | 14 |  |
| dprt | 괴리율 | string | Y | 11 |  |
| atm_cls_name | ATM 구분 명 | string | Y | 10 |  |
| hts_ints_vltl | HTS 내재 변동성 | string | Y | 16 |  |
| acpr | 행사가 | string | Y | 14 |  |
| pvt_scnd_dmrs_prc | 피벗 2차 디저항 가격 | string | Y | 10 |  |
| pvt_frst_dmrs_prc | 피벗 1차 디저항 가격 | string | Y | 10 |  |
| pvt_pont_val | 피벗 포인트 값 | string | Y | 10 |  |
| pvt_frst_dmsp_prc | 피벗 1차 디지지 가격 | string | Y | 10 |  |
| pvt_scnd_dmsp_prc | 피벗 2차 디지지 가격 | string | Y | 10 |  |
| dmsp_val | 디지지 값 | string | Y | 10 |  |
| dmrs_val | 디저항 값 | string | Y | 10 |  |
| elw_sdpr | ELW 기준가 | string | Y | 10 |  |
| apprch_rate | 접근도 | string | Y | 14 |  |
| tick_conv_prc | 틱환산가 | string | Y | 11 |  |
| invt_epmd_cntt | 투자 유의 내용 | string | Y | 200 |  |

## Request Example (Python)

```json
{
"fid_cond_mrkt_div_code": "J",
"fid_input_iscd": "000660"
}
```

## Response Example

```json
{
  "output": {
    "elw_prpr": "0",
    "prdy_vrss": "0",
    "prdy_ctrt": "0.00",
    "acml_vol": "0",
    "prdy_vrss_vol_rate": "0.00",
    "unas_isnm": "BASKET",
    "unas_prpr": "0.00",
    "unas_prdy_vrss": "0.00",
    "unas_prdy_vrss_sign": "3",
    "unas_prdy_ctrt": "0.00",
    "bidp": "0",
    "askp": "0",
    "acml_tr_pbmn": "0",
    "vol_tnrt": "0.00",
    "elw_oprc": "0",
    "elw_hgpr": "0",
    "elw_lwpr": "0",
    "stck_prdy_clpr": "0",
    "hts_thpr": "0.00",
    "dprt": "0.00",
    "atm_cls_name": "ATM",
    "hts_ints_vltl": "0.00",
    "acpr": "0.00",
    "pvt_scnd_dmrs_prc": "0",
    "pvt_frst_dmrs_prc": "0",
    "pvt_pont_val": "0",
    "pvt_frst_dmsp_prc": "0",
    "pvt_scnd_dmsp_prc": "0",
    "dmsp_val": "0",
    "dmrs_val": "0",
    "elw_sdpr": "0",
    "apprch_rate": "0.00",
    "tick_conv_prc": "0.00"
  },
  "rt_cd": "0",
  "msg_cd": "MCA00000",
  "msg1": "정상처리 되었습니다!"
}
```
