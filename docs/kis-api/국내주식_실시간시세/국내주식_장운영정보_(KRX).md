# 국내주식 장운영정보 (KRX)

- 메뉴: [국내주식] 실시간시세
- API ID: `실시간-049` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0STMKO0`
- TR_ID: 실전 `H0STMKO0` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## 개요

국내주식 장운영정보 연결 시, 연결종목의 VI 발동 시와 VI 해제 시에 데이터 수신됩니다. 

[참고자료]
실시간시세(웹소켓) 파이썬 샘플코드는 한국투자증권 Github 참고 부탁드립니다.
https://github.com/koreainvestment/open-trading-api/blob/main/websocket/python/ws_domestic_overseas_all.py

실시간시세(웹소켓) API 사용방법에 대한 자세한 설명은 한국투자증권 Wikidocs 참고 부탁드립니다.
https://wikidocs.net/book/7847 (국내주식 업데이트 완료, 추후 해외주식·국내선물옵션 업데이트 예정)

종목코드 마스터파일 파이썬 정제코드는 한국투자증권 Github 참고 부탁드립니다.
https://github.com/koreainvestment/open-trading-api/tree/main/stocks_info

[호출 데이터]
헤더와 바디 값을 합쳐 JSON 형태로 전송합니다.

[응답 데이터]
1. 정상 등록 여부 (JSON)
- JSON["body"]["msg1"] - 정상 응답 시, SUBSCRIBE SUCCESS
- JSON["body"]["output"]["iv"] - 실시간 결과 복호화에 필요한 AES256 IV (Initialize Vector)
- JSON["body"]["output"]["key"] - 실시간 결과 복호화에 필요한 AES256 Key

2. 실시간 결과 응답 ( | 로 구분되는 값)
ex) 0|H0STCNT0|004|005930^123929^73100^5^...
- 암호화 유무 : 0 암호화 되지 않은 데이터 / 1 암호화된 데이터
- TR_ID : 등록한 tr_id (ex. H0STCNT0)
- 데이터 건수 : (ex. 001 인 경우 데이터 건수 1건, 004인 경우 데이터 건수 4건)
- 응답 데이터 : 아래 response 데이터 참조 ( ^로 구분됨)

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| approval_key | 웹소켓 접속키 | string | Y | 36 | 실시간 (웹소켓) 접속키 발급 API(/oauth2/Approval)를 사용하여 발급받은 웹소켓 접속키 |
| tr_type | 등록/해제 | string | Y | 1 | "1: 등록, 2:해제" |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 7 | H0STMKO0 |
| tr_key | 종목코드 | string | Y | 6 | 종목코드 |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| **MKSC_SHRN_ISCD** | 유가증권단축종목코드 | object | Y | 9 | '각 항목사이에는 구분자로 ^ 사용,<br>모든 데이터타입은 String으로 변환되어 push 처리됨' |
| TRHT_YN | 거래정지여부 | string | Y | 1 |  |
| TR_SUSP_REAS_CNTT | 거래정지사유내용 | string | Y | 100 |  |
| MKOP_CLS_CODE | 장운영구분코드 | string | Y | 3 | 110        장전 동시호가 개시                      <br>112        장개시                                  <br>121        장후 동시호가 개시                      <br>129        장마감                                  <br>130        장개시전시간외개시                      <br>139        장개시전시간외종료                      <br>140        시간외 종가 매매 개시                   <br>146        장종료후시간외 체결지시                 <br>149        시간외 종가 매매 종료                   <br>150        시간외 단일가 매매 개시                 <br>156        시간외단일가 체결지시                   <br>159        시간외 단일가 매매 종료                 <br>164        시장임시정지                            <br>174        서킷브레이크 발동                       <br>175        서킷브레이크 해제                       <br>182        서킷브레이크 장중동시마감               <br>184        서킷브레이크 개시                       <br>185        서킷브레이크 해제                       <br>387        사이드카 매도발동                       <br>388        사이드카 매도발동해제                   <br>397        사이드카 매수발동                       <br>398        사이드카 매수발동해제                   <br>???        단일가개시                              <br>???        서킷브레이크 단일가접수                 <br>F01        장개시 10초전                           <br>F06        장개시 1분전                            <br>F07        장개시 5분전                            <br>F08        장개시 10분전                           <br>F09        장개시 3분전                            <br>F11        장마감 10초전                           <br>F16        장마감 1분전                            <br>F17        장마감 5분전                            <br>F18        장마감 3분전                            <br>P01        장개시 10초전                           <br>P06        장개시 1분전                            <br>P07        장개시 5분전                            <br>P08        장개시 10분전                           <br>P09        장개시 30분전                           <br>P11        장마감 10초전                           <br>P16        장마감 1분전                            <br>P17        장마감 5분전                            <br>P18        장마감 3분전 |
| ANTC_MKOP_CLS_CODE | 예상장운영구분코드 | string | Y | 3 | 112    장전예상종료 <br>121   장후예상시작<br>129   장후예상종료<br>311  장전예상시작 |
| MRKT_TRTM_CLS_CODE | 임의연장구분코드 | string | Y | 1 | 1  시초동시 임의종료 지정<br>2  시초동시 임의종료 해제 <br>3  마감동시 임의종료 지정 <br>4  마감동시 임의종료 해제  <br>5  시간외단일가임의종료 지정 <br>6  시간외단일가임의종료 해제 |
| DIVI_APP_CLS_CODE | 동시호가배분처리구분코드 | string | Y | 2 | divi_app_cls_code[0]  1: 배분개시 2: 배분해제<br>divi_app_cls_code[1] 1: 매수상한 2: 매수하한 3: 매도상한 4: 매도하한 |
| ISCD_STAT_CLS_CODE | 종목상태구분코드 | string | Y | 2 | 51  관리종목 지정 종목<br>52  시장경고 구분이 '투자위험'인 종목<br>53  시장경고 구분이 '투자경고'인 종목<br>54  시장경고 구분이 '투자주의'인 종목<br>55  당사 신용가능 종목<br>57  당사 증거금률이 100인 종목<br>58  거래정지 지정된 종목  <br>59  단기과열종목으로 지정되거나 지정 연장된 종목<br>00 그 외 종목 |
| VI_CLS_CODE | VI적용구분코드 | string | Y | 1 | Y  VI적용된 종목<br>N  VI적용되지 않은 종목 |
| OVTM_VI_CLS_CODE | 시간외단일가VI적용구분코드 | string | Y | 1 | Y 시간외단일가VI 적용된 종목<br>N 시간외단일가VI 적용되지 않은 종목 |
| EXCH_CLS_CODE | 거래소구분코드 | string | Y | 1 |  |

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
            "tr_id": "H0STMKO0",
            "tr_key": "396300"
        }
    }
}
```

## Response Example

```text
# 연결 확인
{
    "header": {
        "tr_id": "H0STMKO0", 
        "tr_key": "396300", 
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
0|H0STMKO0|001|396300^N^(null)^^311^^^55^N^N
```
