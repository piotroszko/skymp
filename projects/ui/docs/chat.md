# Backend to Frontend

## UPDATE_CHAT_SHOW
### Hide/show chat
**data:** true/false

## ADD_CHAT_MSG
### Add message to chat
**data:** "General Tullius: #{ff0000}hello"
> Text after #{rrggbb} will take the specified color

## UPDATE_CHAT_SHOWINPUT
### Change input field display mode
**data:** 'true'/'false'/'auto'
> **'true'** - always show
> **'false'** - always hide
> **'auto'** - open when pressing **f6**


#  Frontend to Backend

## 'cef::chat:send'
### Player sent some message
**data:** 'Some text'
