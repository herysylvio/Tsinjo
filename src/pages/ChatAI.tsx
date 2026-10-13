import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, Bot, User, Sparkles, Plus, History, Search, Pencil, Check, X, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/hooks/useChat';
import { useDynamicSuggestions } from '@/hooks/useDynamicSuggestions';
import { useAccounts } from '@/hooks/useAccounts';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';


const ChatAI = () => {
  const { t, i18n } = useTranslation();
  const {
    messages, isLoading, sendMessage, clearChat, newConversation,
    conversations, loadConversations, loadConversation, deleteConversation, renameConversation,
    accountId, setAccountId,
  } = useChat();
  const { accounts } = useAccounts();
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useDynamicSuggestions();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenHistory = () => {
    loadConversations();
    setSearchQuery('');
    setHistoryOpen(true);
  };

  const handleSelectConversation = (convId: string) => {
    loadConversation(convId);
    setHistoryOpen(false);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-coach/20 text-coach">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">{t('chat.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('chat.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {accounts.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs px-2">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="max-w-[80px] truncate">
                    {accountId ? accounts.find(a => a.id === accountId)?.name || t('chat.all_accounts') : t('chat.all_accounts')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAccountId(null)} className={!accountId ? 'bg-accent' : ''}>
                  {t('chat.all_accounts')}
                </DropdownMenuItem>
                {accounts.map(acc => (
                  <DropdownMenuItem key={acc.id} onClick={() => setAccountId(acc.id)} className={accountId === acc.id ? 'bg-accent' : ''}>
                    {acc.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" onClick={handleOpenHistory} className="text-muted-foreground hover:text-foreground" title={t('chat.history')}>
            <History className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="icon" onClick={newConversation} className="text-muted-foreground hover:text-foreground" title={t('chat.new_conversation')}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={clearChat} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-coach/20 text-coach">
              <Bot className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground mb-1">{t('chat.welcome_title')}</h2>
              <p className="text-sm text-muted-foreground max-w-sm">{t('chat.welcome_desc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-xl border border-border/50 bg-card px-3 py-2.5 text-left text-xs text-foreground hover:bg-muted/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coach/20 text-coach mt-0.5">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border/50 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:text-foreground overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coach/20 text-coach">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-card border border-border/50 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/50 px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none rounded-xl bg-muted/50 border-border/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 rounded-xl bg-primary text-primary-foreground h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[320px] sm:w-[380px] p-0">
          <SheetHeader className="px-4 pt-6 pb-2">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <History className="h-4 w-4" />
              {t('chat.history')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('chat.history')}
            </SheetDescription>
          </SheetHeader>
          {conversations.length > 0 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('chat.search_placeholder')}
                  className="w-full rounded-lg border border-border/50 bg-muted/50 py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
          )}
          <ScrollArea className="h-[calc(100vh-8rem)]">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{t('chat.no_history')}</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-6 w-6 mb-2 opacity-40" />
                <p className="text-sm">Aucun résultat</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 px-2 py-2">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.conversationId}
                    className={`group flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                      conv.isActive
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => editingId !== conv.conversationId && handleSelectConversation(conv.conversationId)}
                  >
                    <div className="flex-1 min-w-0">
                      {editingId === conv.conversationId ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const trimmed = editTitle.trim();
                                if (trimmed) renameConversation(conv.conversationId, trimmed);
                                setEditingId(null);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                            className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-primary"
                            onClick={() => {
                              const trimmed = editTitle.trim();
                              if (trimmed) renameConversation(conv.conversationId, trimmed);
                              setEditingId(null);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-foreground truncate">{conv.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(conv.createdAt), {
                              addSuffix: true,
                              locale: i18n.language === 'fr' ? fr : undefined,
                            })}
                          </p>
                        </>
                      )}
                    </div>
                    {editingId !== conv.conversationId && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(conv.conversationId);
                            setEditTitle(conv.title);
                          }}
                          title={t('chat.rename_conversation')}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.conversationId);
                          }}
                          title={t('chat.delete_conversation')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChatAI;
