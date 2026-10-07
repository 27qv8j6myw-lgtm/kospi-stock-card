# HTS조회상위20종목

- 메뉴: [국내주식] 순위분석
- API ID: `국내주식-214` · 통신방식: REST
- 요청: `GET /uapi/domestic-stock/v1/ranking/hts-top-view`
- TR_ID: 실전 `HHMCM000100C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

HTS조회상위20종목 API입니다. 
한국투자 HTS(eFriend Plus) > [0158] 조회종목상위 화면의 "종목명", "종목코드" 표시 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | HHMCM000100C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

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
| mrkt_div_cls_code | 시장구분 | string | Y | 9 | J : 코스피, Q : 코스닥 |
| mksc_shrn_iscd | 종목코드 | string | Y | 2 | 종목코드 |

## Request Example (Python)

```text
없음
```

## Response Example

```json
{
    "output1": [
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "005930"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "233740"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "458650"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "042660"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "251340"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "000660"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "196170"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "475560"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "163280"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "001470"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "272210"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "017860"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "475960"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "000100"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "035420"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "460930"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "066970"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "378800"
        },
        {
            "mrkt_div_cls_code": "J",
            "mksc_shrn_iscd": "373220"
        },
        {
            "mrkt_div_cls_code": "Q",
            "mksc_shrn_iscd": "255220"
        }
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
