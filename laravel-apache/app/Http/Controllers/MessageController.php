<?php

namespace App\Http\Controllers;

use App\Models\Message;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index()
    {
        return Message::orderBy('created_at', 'desc')->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'content' => 'required|string'
        ]);

        $message = Message::create([
            'content' => $request->content
        ]);

        return response()->json($message, 201);
    }

    public function count()
    {
        return Message::count();
    }

    public function deleteAll()
    {
        Message::truncate();
        return response()->json(['message' => 'All messages deleted successfully']);
    }
} 