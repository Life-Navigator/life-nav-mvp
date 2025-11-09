#!/bin/bash
# Monitor FP16 conversion progress

MODEL_DIR="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16"

echo "🔄 Llama-4-Maverick FP16 Conversion Progress"
echo "=============================================="
echo ""

# Count files
TOTAL_FILES=55
CONVERTED=$(ls "$MODEL_DIR"/model-*.safetensors 2>/dev/null | wc -l)
PERCENT=$(( CONVERTED * 100 / TOTAL_FILES ))

echo "Files:    $CONVERTED / $TOTAL_FILES ($PERCENT%)"

# Check size
SIZE=$(du -sh "$MODEL_DIR" 2>/dev/null | cut -f1)
echo "Size:     $SIZE / ~749GB"

# Check if process is running
if ps aux | grep "convert_model_to_fp16.py" | grep -v grep > /dev/null; then
    echo "Status:   ✅ Converting (active)"

    # Show latest file
    LATEST=$(ls -t "$MODEL_DIR"/model-*.safetensors 2>/dev/null | head -1 | xargs basename)
    echo "Latest:   $LATEST"

    # Estimate time
    if [ $CONVERTED -gt 0 ]; then
        REMAINING=$(( TOTAL_FILES - CONVERTED ))
        EST_MIN=$(( REMAINING / 3 ))
        echo "Est. time: ~$EST_MIN minutes remaining"
    fi
else
    if [ $CONVERTED -eq $TOTAL_FILES ]; then
        echo "Status:   ✅ Complete!"
    else
        echo "Status:   ⚠️  Not running (incomplete)"
    fi
fi

echo ""
echo "Log file: /tmp/fp16_conversion.log"
echo ""
