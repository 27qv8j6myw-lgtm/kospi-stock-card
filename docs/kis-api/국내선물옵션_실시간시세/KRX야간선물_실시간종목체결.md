# KRX야간선물 실시간종목체결

- 메뉴: [국내선물옵션] 실시간시세
- API ID: `실시간-064` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0MFCNT0`
- TR_ID: 실전 `H0MFCNT0` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## 개요

[참고자료]

실시간시세(웹소켓) 파이썬 샘플코드는 한국투자증권 Github 참고 부탁드립니다.
https://github.com/koreainvestment/open-trading-api/tree/main/examples_user/domestic_futureoption

실시간시세(웹소켓) API 사용방법에 대한 자세한 설명은 한국투자증권 Wikidocs 참고 부탁드립니다.
https://wikidocs.net/book/7847 (국내주식, 해외주식 내용 참고)

시세조회 가능한 종목코드 목록은 API문서 > 종목정보파일 에서 확인하실 수 있습니다. ( 헤더파일 및 정제코드 참고)

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| approval_key | 웹소켓 접속키 | string | Y | 36 | 실시간 (웹소켓) 접속키 발급 API(/oauth2/Approval)를 사용하여 발급받은 웹소켓 접속키 |
| tr_type | 등록/해제 | string | Y | 1 | 1: 등록, 2:해제 |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 2 | H0MFCNT0 |
| tr_key | 구분값 | string | Y | 12 | 야간선물 종목코드 |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FUTS_SHRN_ISCD | 선물 단축 종목코드 | string | Y | 9 |  |
| BSOP_HOUR | 영업 시간 | string | Y | 6 |  |
| FUTS_PRDY_VRSS | 선물 전일 대비 | string | Y | 1 |  |
| PRDY_VRSS_SIGN | 전일 대비 부호 | string | Y | 1 | 1: 상한<br>2: 상승<br>3: 보합<br>4: 하한<br>5: 하락 |
| FUTS_PRDY_CTRT | 선물 전일 대비율 | string | Y | 1 |  |
| FUTS_PRPR | 선물 현재가 | string | Y | 1 |  |
| FUTS_OPRC | 선물 시가2 | string | Y | 1 |  |
| FUTS_HGPR | 선물 최고가 | string | Y | 1 |  |
| FUTS_LWPR | 선물 최저가 | string | Y | 1 |  |
| LAST_CNQN | 최종 거래량 | string | Y | 1 |  |
| ACML_VOL | 누적 거래량 | string | Y | 1 |  |
| ACML_TR_PBMN | 누적 거래 대금 | string | Y | 1 |  |
| HTS_THPR | HTS 이론가 | string | Y | 1 |  |
| MRKT_BASIS | 시장 베이시스 | string | Y | 1 |  |
| DPRT | 괴리율 | string | Y | 1 |  |
| NMSC_FCTN_STPL_PRC | 근월물 약정가 | string | Y | 1 |  |
| FMSC_FCTN_STPL_PRC | 원월물 약정가 | string | Y | 1 |  |
| SPEAD_PRC | 스프레드1 | string | Y | 1 |  |
| HTS_OTST_STPL_QTY | HTS 미결제 약정 수량 | string | Y | 1 |  |
| OTST_STPL_QTY_ICDC | 미결제 약정 수량 증감 | string | Y | 1 |  |
| OPRC_HOUR | 시가 시간 | string | Y | 6 |  |
| OPRC_VRSS_PRPR_SIGN | 시가2 대비 현재가 부호 | string | Y | 1 |  |
| OPRC_VRSS_NMIX_PRPR | 시가 대비 지수 현재가 | string | Y | 1 |  |
| HGPR_HOUR | 최고가 시간 | string | Y | 6 |  |
| HGPR_VRSS_PRPR_SIGN | 최고가 대비 현재가 부호 | string | Y | 1 |  |
| HGPR_VRSS_NMIX_PRPR | 최고가 대비 지수 현재가 | string | Y | 1 |  |
| LWPR_HOUR | 최저가 시간 | string | Y | 6 |  |
| LWPR_VRSS_PRPR_SIGN | 최저가 대비 현재가 부호 | string | Y | 1 |  |
| LWPR_VRSS_NMIX_PRPR | 최저가 대비 지수 현재가 | string | Y | 1 |  |
| SHNU_RATE | 매수2 비율 | string | Y | 1 |  |
| CTTR | 체결강도 | string | Y | 1 |  |
| ESDG | 괴리도 | string | Y | 1 |  |
| OTST_STPL_RGBF_QTY_ICDC | 미결제 약정 직전 수량 증감 | string | Y | 1 |  |
| THPR_BASIS | 이론 베이시스 | string | Y | 1 |  |
| FUTS_ASKP1 | 선물 매도호가1 | string | Y | 1 |  |
| FUTS_BIDP1 | 선물 매수호가1 | string | Y | 1 |  |
| ASKP_RSQN1 | 매도호가 잔량1 | string | Y | 1 |  |
| BIDP_RSQN1 | 매수호가 잔량1 | string | Y | 1 |  |
| SELN_CNTG_CSNU | 매도 체결 건수 | string | Y | 1 |  |
| SHNU_CNTG_CSNU | 매수 체결 건수 | string | Y | 1 |  |
| NTBY_CNTG_CSNU | 순매수 체결 건수 | string | Y | 1 |  |
| SELN_CNTG_SMTN | 총 매도 수량 | string | Y | 1 |  |
| SHNU_CNTG_SMTN | 총 매수 수량 | string | Y | 1 |  |
| TOTAL_ASKP_RSQN | 총 매도호가 잔량 | string | Y | 1 |  |
| TOTAL_BIDP_RSQN | 총 매수호가 잔량 | string | Y | 1 |  |
| PRDY_VOL_VRSS_ACML_VOL_RATE | 전일 거래량 대비 등락율 | string | Y | 1 |  |
| DYNM_MXPR | 실시간상한가 | string | Y | 8 |  |
| DYNM_LLAM | 실시간하한가 | string | Y | 8 |  |
| DYNM_PRC_LIMT_YN | 실시간가격제한구분 | string | Y | 1 |  |

## Request Example (Python)

```json
{
    "header": {
        "approval_key": "35xxxxxa-bxxa-4xxb-87xxx-f56xxxxxxxxxx",
        "custtype": "P",
        "tr_type": "1",
        "content-type": "utf-8"
    },
    "body": {
        "input": {
            "tr_id": "H0MFCNT0",
            "tr_key": "101V06"
        }
    }
}
```

## Response Example

```text
# 연결 확인
{
    "header": {
        "tr_id": "H0MFCNT0", 
        "tr_key": "101V06", 
        "encrypt": "N"
        }, 
    "body": {
        "rt_cd": "0", 
        "msg_cd": "OPSP0000",
        "msg1": "SUBSCRIBE SUCCESS", 
        "output": {
            "iv": "0123456789abcdef", 
            "key": "abcdefghijklmnopabcdefghijklmnop"}
        }
}

# output
0|H0MFCNT0|001|101V06^190215^0.75^2^0.20^367.30^367.10^367.60^367.05^2^1596^1465526
87^366.08^1.22^0.33^0.00^0.00^0.00^268223^0^000000^2^0.20^000000^5^-0.30^000000^2^0.25^0.49^96.31^1.2
2^0^0.00^367.35^367.30^0^0^345^358^13^813^783^0^0^0.00
```
