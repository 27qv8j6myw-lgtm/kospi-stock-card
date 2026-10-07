# ELW LP매매추이

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-182` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/lp-trade-trend`
- TR_ID: 실전 `FHPEW03760000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW LP매매추이 API입니다.
한국투자 HTS(eFriend Plus) > [0376] ELW LP매매추이 화면 의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW03760000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분(W) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | 입력종목코드(ex 52K577(미래 K577KOSDAQ150콜) |

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
| **output1** | 응답상세 | object | Y |  |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| prdy_vol | 전일거래량 | string | Y | 18 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| prit | 패리티 | string | Y | 112 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| gear | 기어링 | string | Y | 84 |  |
| prls_qryr_rate | 손익분기비율 | string | Y | 84 |  |
| cfp | 자본지지점 | string | Y | 112 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| tmvl_val | 시간가치값 | string | Y | 132 |  |
| acpr | 행사가 | string | Y | 112 |  |
| elw_ko_barrier | 조기종료발생기준가격 | string | Y | 112 |  |
| **output2** | 응답상세 | object array | Y |  | array |
| stck_bsop_date | 주식영업일자 | string | Y | 8 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| lp_seln_qty | LP매도수량 | string | Y | 19 |  |
| lp_seln_avrg_unpr | LP매도평균단가 | string | Y | 19 |  |
| lp_shnu_qty | LP매수수량 | string | Y | 19 |  |
| lp_shnu_avrg_unpr | LP매수평균단가 | string | Y | 19 |  |
| lp_hvol | LP보유량 | string | Y | 18 |  |
| lp_hldn_rate | LP보유비율 | string | Y | 84 |  |
| prsn_deal_qty | 개인매매수량 | string | Y | 19 |  |
| apprch_rate | 접근도 | string | Y | 112 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:57K281
```

## Response Example

```json
{
    "output1": {
        "elw_prpr": "40",
        "prdy_vrss_sign": "2",
        "prdy_vrss": "5",
        "prdy_ctrt": "14.29",
        "acml_vol": "320750",
        "prdy_vol": "114850",
        "stck_cnvr_rate": "0.010000",
        "prit": "103.35",
        "lvrg_val": "-12.130651",
        "gear": "19.3500",
        "prls_qryr_rate": "-1.8000",
        "cfp": "-1.7100",
        "invl_val": "27.00",
        "tmvl_val": "13.00",
        "acpr": "80000.00",
        "elw_ko_barrier": "0.00"
    },
    "output2": [
        {
            "stck_bsop_date": "20240516",
            "elw_prpr": "35",
            "prdy_vrss_sign": "3",
            "prdy_vrss": "0",
            "prdy_ctrt": "0.00",
            "lp_seln_qty": "30030",
            "lp_seln_avrg_unpr": "30",
            "lp_shnu_qty": "84810",
            "lp_shnu_avrg_unpr": "34",
            "lp_hvol": "7999900",
            "lp_hldn_rate": "99.99",
            "prsn_deal_qty": "10",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_date": "20240514",
            "elw_prpr": "35",
            "prdy_vrss_sign": "5",
            "prdy_vrss": "-5",
            "prdy_ctrt": "-12.50",
            "lp_seln_qty": "73510",
            "lp_seln_avrg_unpr": "35",
            "lp_shnu_qty": "74440",
            "lp_shnu_avrg_unpr": "35",
            "lp_hvol": "7945120",
            "lp_hldn_rate": "99.31",
            "prsn_deal_qty": "1260",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_date": "20240513",
            "elw_prpr": "40",
            "prdy_vrss_sign": "2",
            "prdy_vrss": "10",
            "prdy_ctrt": "33.33",
            "lp_seln_qty": "282010",
            "lp_seln_avrg_unpr": "36",
            "lp_shnu_qty": "277980",
            "lp_shnu_avrg_unpr": "36",
            "lp_hvol": "7944190",
            "lp_hldn_rate": "99.30",
            "prsn_deal_qty": "11140",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_date": "20240510",
            "elw_prpr": "30",
            "prdy_vrss_sign": "2",
            "prdy_vrss": "5",
            "prdy_ctrt": "20.00",
            "lp_seln_qty": "137480",
            "lp_seln_avrg_unpr": "27",
            "lp_shnu_qty": "209950",
            "lp_shnu_avrg_unpr": "25",
            "lp_hvol": "7948220",
            "lp_hldn_rate": "99.35",
            "prsn_deal_qty": "2040",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_dat
... (생략)
```
