from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Python microservice is running "})

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_input = data.get("input")
    result = output(user_input)
    return jsonify({"response": result})

def output(text: str):
    return f"Here is the output of the chat for: {text}"

if __name__ == "__main__":
    app.run(port=5000)
