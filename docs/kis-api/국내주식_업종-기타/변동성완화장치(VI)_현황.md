# 변동성완화장치(VI) 현황

- 메뉴: [국내주식] 업종/기타
- API ID: `v1_국내주식-055` · 통신방식: REST
- 요청: `GET /uapi/domestic-stock/v1/quotations/inquire-vi-status`
- TR_ID: 실전 `FHPST01390000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

HTS(eFriend Plus) [0139] 변동성 완화장치(VI) 현황 데이터를 확인할 수 있는 API입니다.

최근 30건까지 확인 가능합니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPST01390000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_DIV_CLS_CODE | FID 분류 구분 코드 | string | Y | 2 | 0:전체 1:상승 2:하락 |
| FID_COND_SCR_DIV_CODE | FID 조건 화면 분류 코드 | string | Y | 5 | 20139 |
| FID_MRKT_CLS_CODE | FID 시장 구분 코드 | string | Y | 2 | 0:전체 K:거래소 Q:코스닥 |
| FID_INPUT_ISCD | FID 입력 종목코드 | string | Y | 12 |  |
| FID_RANK_SORT_CLS_CODE | FID 순위 정렬 구분 코드 | string | Y | 2 | 0:전체1:정적2:동적3:정적&동적 |
| FID_INPUT_DATE_1 | FID 입력 날짜1 | string | Y | 10 | 영업일 |
| FID_TRGT_CLS_CODE | FID 대상 구분 코드 | string | Y | 32 |  |
| FID_TRGT_EXLS_CLS_CODE | FID 대상 제외 구분 코드 | string | Y | 32 |  |

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
| **output** | 응답상세 | object | Y |  |  |
| hts_kor_isnm | HTS 한글 종목명 | string | Y | 40 |  |
| mksc_shrn_iscd | 유가증권 단축 종목코드 | string | Y | 9 |  |
| vi_cls_code | VI발동상태 | string | Y | 1 | Y: 발동 / N: 해제 |
| bsop_date | 영업 일자 | string | Y | 8 |  |
| cntg_vi_hour | VI발동시간 | string | Y | 6 | VI발동시간 |
| vi_cncl_hour | VI해제시간 | string | Y | 6 | VI해제시간 |
| vi_kind_code | VI종류코드 | string | Y | 1 | 1:정적 2:동적 3:정적&동적 |
| vi_prc | VI발동가격 | string | Y | 10 |  |
| vi_stnd_prc | 정적VI발동기준가격 | string | Y | 10 |  |
| vi_dprt | 정적VI발동괴리율 | string | Y | 82 | % |
| vi_dmc_stnd_prc | 동적VI발동기준가격 | string | Y | 10 |  |
| vi_dmc_dprt | 동적VI발동괴리율 | string | Y | 82 | % |
| vi_count | VI발동횟수 | string | Y | 7 |  |

## Request Example (Python)

```json
{
	"fid_cond_scr_div_code":"20139",
	"fid_mrkt_cls_code":"0",
	"fid_input_iscd":"",
	"fid_rank_sort_cls_code":"0",
	"fid_input_date_1":"20240126",
	"fid_trgt_cls_code":"",
	"fid_trgt_exls_cls_code":"",
	"fid_div_cls_code":"0"
}
```

## Response Example

```json
{
    "output": [
        {
            "hts_kor_isnm": "KODEX Fn멀티팩터",
            "mksc_shrn_iscd": "337120",
            "vi_cls_code": "N",
            "bsop_date": "20240126",
            "cntg_vi_hour": "174012",
            "vi_cncl_hour": "174212",
            "vi_kind_code": "2",
            "vi_prc": "12135",
            "vi_stnd_prc": "0",
            "vi_dprt": "0.00",
            "vi_dmc_stnd_prc": "13275",
            "vi_dmc_dprt": "-8.59",
            "vi_count": "2"
        },
        {
            "hts_kor_isnm": "루멘스",
            "mksc_shrn_iscd": "038060",
            "vi_cls_code": "N",
            "bsop_date": "20240126",
            "cntg_vi_hour": "174008",
            "vi_cncl_hour": "174210",
            "vi_kind_code": "2",
            "vi_prc": "1337",
            "vi_stnd_prc": "0",
            "vi_dprt": "0.00",
            "vi_dmc_stnd_prc": "1241",
            "vi_dmc_dprt": "7.74",
            "vi_count": "1"
        },
        {
            "hts_kor_isnm": "DL건설",
            "mksc_shrn_iscd": "001880",
            "vi_cls_code": "N",
            "bsop_date": "20240126",
            "cntg_vi_hour": "173030",
            "vi_cncl_hour": "173234",
            "vi_kind_code": "2",
            "vi_prc": "14000",
            "vi_stnd_prc": "0",
            "vi_dprt": "0.00",
            "vi_dmc_stnd_prc": "14990",
            "vi_dmc_dprt": "-6.60",
            "vi_count": "2"
        },
        {
            "hts_kor_isnm": "성창기업지주",
            "mksc_shrn_iscd": "000180",
            "vi_cls_code": "N",
            "bsop_date": "20240126",
            "cntg_vi_hour": "173030",
            "vi_cncl_hour": "173224",
            "vi_kind_code": "2",
            "vi_prc": "1860",
            "vi_stnd_prc": "0",
            "vi_dprt": "0.00",
            "vi_dmc_stnd_prc": "1992",
            "vi_dmc_dprt": "-6.63",
            "vi_count": "2"
        },
        {
            "hts_kor_isnm": "성창기업지주",
            "mksc_shrn_iscd": "000180",
            "vi_cls_code": "N",
            "bsop_date": "20240126",
            "cntg_vi_hour": "172030",
            "vi_cncl_hour": "172204",
            "vi_kind_code": "2",
            "vi_prc": "1992",
            "vi_stnd_prc": "0",
            "vi_dprt": "0.00",
            "vi_dmc_stnd_prc": "1857",
            "vi_dmc_dprt": "7.27",
            "vi_count": "1"
        },
        {
            "hts_kor_isnm": "유아이디",
            "mksc_shrn_iscd": "069330",
            "vi_cls_code": "
... (생략)
```
