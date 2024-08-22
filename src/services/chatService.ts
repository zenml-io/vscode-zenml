export class ChatService {
    private static instance: ChatService;
    private tokenjs: any; // Update the type accordingly
    private initialized: Promise<void>;

    private constructor() {
        // handling initialization as promise
        this.initialized = this.initialize();
    }


    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    private async initialize() {
        console.log('starting to initialize chatservice');
        try {
            // Use dynamic import to load the ESM module
            const { TokenJS } = await import('token.js');

            // TODO find another way to access the apiKey, instead of having it hardcoded
            const apiKey = 'GEMINI_API_KEY_GOES_HERE';
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY is not set');
            }
            this.tokenjs = new TokenJS({ apiKey });
        } catch (error) {
            console.error('Error initializing TokenJS:', error);
            this.tokenjs = null; // ensure tokenjs is null if initialization fails
        }
    }

    public async getChatResponse(message: string): Promise<string> {
        try {
            // wait for initialization to complete
            await this.initialize();

            if (!this.tokenjs) {
                throw new Error('ChatService not initialized properly');
            }

            const completion = await this.tokenjs.chat.completions.create({
                provider: 'gemini',
                model: 'gemini-1.5-flash',
                messages: [{ role: 'user', content: message }],
            });
            return completion.choices[0]?.message?.content || 'No content';
        } catch (error) {
            console.error('Error with Gemini API:', error);
            return 'Error: Unable to get a response from Gemini.';
        }
    }
}
