import React, { useState } from "react";
import { OpenAI } from "openai";
import "./App.css";

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  // 고정된 프롬프트 정의
  const FIXED_PROMPT = "왼쪽, 오른쪽 파트를 각각 영어로 번역하고 중괄호로만 감싸진 json 포맷으로 변환한것만 나에게 줘. '```', 'json'은 출력하지마. json 파일 필드명은  bank, account_number, name, amount 로 해줘.'Left', 'Right' 도 출력해줘.";

  const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      alert("이미지를 선택해주세요.");
      return;
    }

    setLoading(true);
    try {
      // 이미지를 base64에서 blob으로 변환
      const base64Data = selectedImage.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());

      // GPT API 호출
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: FIXED_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: selectedImage
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error("API 응답 형식이 올바르지 않습니다.");
      }

      const analysisResult = response.choices[0].message.content;
      setResponse(analysisResult);

      // 서버에 결과 저장
      try {
        console.log('서버에 저장 요청 시작:', analysisResult); // 저장 요청 시작 로깅
        const saveResponse = await fetch('http://localhost:5000/save-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            response: analysisResult
          })
        });

        const saveResult = await saveResponse.json();
        console.log('서버 저장 응답:', saveResult); // 서버 응답 로깅
        
        if (!saveResult.success) {
          console.error('결과 저장 실패:', saveResult.message);
        } else {
          console.log('결과 저장 성공:', saveResult.filename);
        }
      } catch (saveError) {
        console.error('결과 저장 중 오류:', saveError);
      }

    } catch (error) {
      console.error("API Error Details:", {
        message: error.message,
        status: error.status,
        type: error.type,
        code: error.code
      });
      
      if (error.response) {
        console.error("Error Response:", error.response.data);
      }
      
      alert(`API 호출 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>이미지 분석 앱</h1>
      
      <div className="upload-section">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ marginBottom: "20px" }}
        />
        {selectedImage && (
          <div style={{ marginBottom: "20px" }}>
            <img 
              src={selectedImage} 
              alt="Selected" 
              style={{ maxWidth: "300px", maxHeight: "300px" }} 
            />
          </div>
        )}
      </div>

      <button 
        onClick={handleSubmit}
        disabled={loading || !selectedImage}
      >
        {loading ? "분석 중..." : "분석하기"}
      </button>

      {response && (
        <div className="response-section" style={{ marginTop: "20px" }}>
          <h3>분석 결과:</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default App;
