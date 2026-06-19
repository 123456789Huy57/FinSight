function load_students_fromxml(dataset_path,bodystudent)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET",dataset_path,true);
    xhr.send();
    xhr.onreadystatechange=function()
    {
        if (xhr.readyState==4 && xhr.status==200)
        {
            //Handling when loading data successfully
            // Khi vao day tuc la da ve local --> Dung DOM bai truoc
            var xmlDoc =xhr.responseXML;
            tag_students=xmlDoc.getElementsByTagName("student")
            for(i=0;i<tag_students.length;i++)
            {
            value_tag_id=tag_students[i].getElementsByTagName("id")[0].childNodes[0].nodeValue
            value_tag_name=tag_students[i].getElementsByTagName("name")[0].childNodes[0].nodeValue
            value_tag_birthday=tag_students[i].getElementsByTagName("birthday")[0].childNodes[0].nodeValue
            value_tag_gender=tag_students[i].getElementsByTagName("gender")[0].childNodes[0].nodeValue
            tr=document.createElement("tr")
            td_id=document.createElement("td")
            td_id.innerHTML=value_tag_id
            td_name=document.createElement("td")
            td_name.innerHTML=value_tag_name
            td_birthday=document.createElement("td")
            td_birthday.innerHTML=value_tag_birthday
            td_gender=document.createElement("td")
            td_gender.innerHTML=value_tag_gender
            tr.appendChild(td_id);
            tr.appendChild(td_name);
            tr.appendChild(td_birthday);
            tr.appendChild(td_gender);

            tr.style.cursor="pointer"
            tr.onclick=function(){
                open_detail(
                    this.getElementsByTagName("td")[0].innerHTML,
                    this.getElementsByTagName("td")[1].innerHTML,
                    this.getElementsByTagName("td")[2].innerHTML,
                    this.getElementsByTagName("td")[3].innerHTML
                )
            }

            bodystudent.appendChild(tr);
            }
        }
    }
}

function open_detail(id, name, birthday, gender)
{
    localStorage.setItem("student_id", id)
    localStorage.setItem("student_name", name)
    localStorage.setItem("student_birthday", birthday)
    localStorage.setItem("student_gender", gender)
    window.location.href="detail.html"
}

function load_detail(bodydetail)
{
    var id=localStorage.getItem("student_id")
    var name=localStorage.getItem("student_name")
    var birthday=localStorage.getItem("student_birthday")
    var gender=localStorage.getItem("student_gender")
    tr=document.createElement("tr")
    td_label=document.createElement("td")
    td_label.innerHTML="Student ID:"
    td_value=document.createElement("td")
    td_value.innerHTML=id
    tr.appendChild(td_label)
    tr.appendChild(td_value)
    bodydetail.appendChild(tr)
    tr=document.createElement("tr")
    td_label=document.createElement("td")
    td_label.innerHTML="Student Name:"
    td_value=document.createElement("td")
    td_value.innerHTML=name
    tr.appendChild(td_label)
    tr.appendChild(td_value)
    bodydetail.appendChild(tr)
    tr=document.createElement("tr")
    td_label=document.createElement("td")
    td_label.innerHTML="Birthday:"
    td_value=document.createElement("td")
    td_value.innerHTML=birthday
    tr.appendChild(td_label)
    tr.appendChild(td_value)
    bodydetail.appendChild(tr)
    tr=document.createElement("tr")
    td_label=document.createElement("td")
    td_label.innerHTML="Gender:"
    td_value=document.createElement("td")
    td_value.innerHTML=gender
    tr.appendChild(td_label)
    tr.appendChild(td_value)
    bodydetail.appendChild(tr)
}

var sort_direction={}
var col_names=["Student ID","Student Name","Student Birthday","Student Gender"]
function sort_table(col_index)
{
    var tbody=document.getElementById("bodystudent")
    var rows=Array.from(tbody.getElementsByTagName("tr"))
    var asc=sort_direction[col_index]!==true
    sort_direction[col_index]=asc
    rows.sort(function(rowA,rowB){
        var a=rowA.getElementsByTagName("td")[col_index].innerHTML.trim()
        var b=rowB.getElementsByTagName("td")[col_index].innerHTML.trim()
        return asc ? a.localeCompare(b) : b.localeCompare(a)
    })
    tbody.innerHTML=""
    for(var i=0;i<rows.length;i++){
        tbody.appendChild(rows[i])
    }
    var headers=document.getElementsByTagName("th")
    for(var i=1;i<=4;i++){
        headers[i].innerHTML=col_names[i-1]
    }
    headers[col_index+1].innerHTML=col_names[col_index]+(asc ? " ▲" : " ▼")
}