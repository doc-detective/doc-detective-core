const {
    VertexAI,
    FunctionDeclarationSchemaType,
  } = require('@google-cloud/vertexai');
  
  const functionDeclarations = [
    {
      function_declarations: [
        {
          name: 'get_current_weather',
          description: 'get weather in a given location',
          parameters: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              location: {type: FunctionDeclarationSchemaType.STRING},
              unit: {
                type: FunctionDeclarationSchemaType.STRING,
                enum: ['celsius', 'fahrenheit'],
              },
            },
            required: ['location'],
          },
        },
      ],
    },
  ];
  
  const functionResponseParts = [
    {
      functionResponse: {
        name: 'get_current_weather',
        response: {name: 'get_current_weather', content: {weather: 'super nice'}},
      },
    },
  ];
  
  /**
   * TODO(developer): Update these variables before running the sample.
   */
  async function functionCallingStreamChat(
    projectId = 'dd-gemini',
    location = 'us-central1',
    model = 'gemini-1.0-pro'
  ) {
    // Initialize Vertex with your Cloud project and location
    const vertexAI = new VertexAI({project: projectId, location: location});
  
    // Instantiate the model
    const generativeModel = vertexAI.preview.getGenerativeModel({
      model: model,
    });
  
    const request = {
      contents: [
        {role: 'user', parts: [{text: 'What is the weather in Boston?'}]},
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'get_current_weather',
                args: {location: 'Boston'},
              },
            },
          ],
        },
        {role: 'function', parts: functionResponseParts},
      ],
      tools: functionDeclarations,
    };
    const streamingResp = await generativeModel.generateContentStream(request);
    for await (const item of streamingResp.stream) {
      console.log(item.candidates[0].content.parts[0].text);
    }
  }