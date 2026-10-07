# ELW 거래량순위

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-168` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/ranking/volume-rank`
- TR_ID: 실전 `FHPEW02780000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 거래량순위 API입니다. 
한국투자 HTS(eFriend Plus) > [0278] ELW 거래량순위 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02780000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | W |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | 20278 |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | 000000 |
| FID_INPUT_ISCD | 발행사 | string | Y | 12 | 00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_INPUT_RMNN_DYNU_1 | 입력잔존일수 | string | Y | 5 |  |
| FID_DIV_CLS_CODE | 콜풋구분코드 | string | Y | 2 | 0(전체), 1(콜), 2(풋) |
| FID_INPUT_PRICE_1 | 가격(이상) | string | Y | 12 | 거래가격1(이상) |
| FID_INPUT_PRICE_2 | 가격(이하) | string | Y | 12 | 거래가격1(이하) |
| FID_INPUT_VOL_1 | 거래량(이상) | string | Y | 18 | 거래량1(이상) |
| FID_INPUT_VOL_2 | 거래량(이하) | string | Y | 18 | 거래량1(이하) |
| FID_INPUT_DATE_1 | 조회기준일 | string | Y | 10 | 입력날짜(기준가 조회기준) |
| FID_RANK_SORT_CLS_CODE | 순위정렬구분코드 | string | Y | 2 | 0: 거래량순 1: 평균거래증가율 2: 평균거래회전율 3:거래금액순 4: 순매수잔량순 5: 순매도잔량순 |
| FID_BLNG_CLS_CODE | 소속구분코드 | string | Y | 2 | 0: 전체 |
| FID_INPUT_ISCD_2 | LP발행사 | string | Y | 8 | 0000 |
| FID_INPUT_DATE_2 | 만기일-최종거래일조회 | string | Y | 10 | 공백 |

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
| **output** | 응답상세 | object array | Y |  | array |
| elw_kor_isnm | ELW한글종목명 | string | Y | 40 |  |
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| lstn_stcn | 상장주수 | string | Y | 18 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| n_prdy_vol | N전일거래량 | string | Y | 18 |  |
| n_prdy_vol_vrss | N전일거래량대비 | string | Y | 18 |  |
| vol_inrt | 거래량증가율 | string | Y | 84 |  |
| vol_tnrt | 거래량회전율 | string | Y | 82 |  |
| nday_vol_tnrt | N일거래량회전율 | string | Y | 8 |  |
| acml_tr_pbmn | 누적거래대금 | string | Y | 18 |  |
| n_prdy_tr_pbmn | N전일거래대금 | string | Y | 18 |  |
| n_prdy_tr_pbmn_vrss | N전일거래대금대비 | string | Y | 18 |  |
| total_askp_rsqn | 총매도호가잔량 | string | Y | 12 |  |
| total_bidp_rsqn | 총매수호가잔량 | string | Y | 12 |  |
| ntsl_rsqn | 순매도잔량 | string | Y | 13 |  |
| ntby_rsqn | 순매수잔량 | string | Y | 12 |  |
| seln_rsqn_rate | 매도잔량비율 | string | Y | 84 |  |
| shnu_rsqn_rate | 매수2잔량비율 | string | Y | 84 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| hts_rmnn_dynu | HTS잔존일수 | string | Y | 5 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| tmvl_val | 시간가치값 | string | Y | 132 |  |
| acpr | 행사가 | string | Y | 112 |  |
| lp_mbcr_name | LP회원사명 | string | Y | 50 |  |
| unas_isnm | 기초자산명 | string | Y | 40 |  |
| stck_last_tr_date | 최종거래일 | string | Y | 8 |  |
| unas_shrn_iscd | 기초자산코드 | string | Y | 12 |  |
| prdy_vol | 전일거래량 | string | Y | 18 |  |
| lp_hldn_rate | LP보유비율 | string | Y | 84 |  |
| prit | 패리티 | string | Y | 112 |  |
| prls_qryr_stpr_prc | 손익분기주가가격 | string | Y | 112 |  |
| delta_val | 델타값 | string | Y | 114 |  |
| theta | 세타 | string | Y | 84 |  |
| prls_qryr_rate | 손익분기비율 | string | Y | 84 |  |
| stck_lstn_date | 주식상장일자 | string | Y | 8 |  |
| hts_ints_vltl | HTS내재변동성 | string | Y | 114 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| lp_ntby_qty | LP순매도량 | string | Y | 18 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:20278
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD:00000
FID_INPUT_RMNN_DYNU_1:0
FID_DIV_CLS_CODE:0
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_INPUT_DATE_1:
FID_RANK_SORT_CLS_CODE:0
FID_BLNG_CLS_CODE:0
FID_INPUT_ISCD_2:0000
FID_INPUT_DATE_2:
```

## Response Example

```json
{
    "output": [
        {
            "elw_kor_isnm": "한국JS54KOSPI200콜",
            "elw_shrn_iscd": "57JS54",
            "elw_prpr": "135",
            "prdy_vrss": "-100",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-42.55",
            "lstn_stcn": "10000000",
            "acml_vol": "44020240",
            "n_prdy_vol": "0",
            "n_prdy_vol_vrss": "44020240",
            "vol_inrt": "0.00",
            "vol_tnrt": "440.20",
            "nday_vol_tnrt": "440.20",
            "acml_tr_pbmn": "7881452400",
            "n_prdy_tr_pbmn": "7881452400",
            "n_prdy_tr_pbmn_vrss": "0",
            "total_askp_rsqn": "1512690",
            "total_bidp_rsqn": "337490",
            "ntsl_rsqn": "-1175200",
            "ntby_rsqn": "-1175200",
            "seln_rsqn_rate": "81.76",
            "shnu_rsqn_rate": "18.24",
            "stck_cnvr_rate": "100.000000",
            "hts_rmnn_dynu": "28",
            "invl_val": "0.00",
            "tmvl_val": "135.00",
            "acpr": "385.00",
            "lp_mbcr_name": "한국증권",
            "unas_isnm": "KOSPI200",
            "stck_last_tr_date": "20240509",
            "unas_shrn_iscd": "2001",
            "prdy_vol": "9013220",
            "lp_hldn_rate": "11.21",
            "prit": "95.38",
            "prls_qryr_stpr_prc": "386.35",
            "delta_val": "0.160726",
            "theta": "12.4577",
            "prls_qryr_rate": "5.2000",
            "stck_lstn_date": "20230817",
            "hts_ints_vltl": "16.98",
            "lvrg_val": "43.722294",
            "lp_ntby_qty": "5919560"
        },
        {
            "elw_kor_isnm": "한국JS57KOSPI200풋",
            "elw_shrn_iscd": "57JS57",
            "elw_prpr": "250",
            "prdy_vrss": "15",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "6.38",
            "lstn_stcn": "10000000",
            "acml_vol": "41360790",
            "n_prdy_vol": "0",
            "n_prdy_vol_vrss": "41360790",
            "vol_inrt": "0.00",
            "vol_tnrt": "413.61",
            "nday_vol_tnrt": "413.61",
            "acml_tr_pbmn": "9642006500",
            "n_prdy_tr_pbmn": "9642006500",
            "n_prdy_tr_pbmn_vrss": "0",
            "total_askp_rsqn": "591950",
            "total_bidp_rsqn": "320140",
            "ntsl_rsqn": "-271810",
            "ntby_rsqn": "-271810",
            "seln_rsqn_rate": "64.90",
            "shnu_rsqn_rate": "35.10",
            "stck_cnvr_rate": "100.000000",
         
... (생략)
```
